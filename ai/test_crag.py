"""
cRAG End-to-End Test
====================
Tests the full Corrective RAG pipeline for chat:
  1. Chunker — converts medical records into text chunks
  2. Embedder — embeds chunks into 384-dim vectors
  3. Index Store — builds FAISS index and searches it
  4. Grader — grades chunk relevance via Groq LLM
  5. cRAG — full corrective_rag() pipeline
  6. ai.py entry-point — chat_with_rognidhi() routes to cRAG

Run from project root:
  python ai/test_crag.py
"""

import os
import sys
import logging

# ── Setup ─────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

# Load .env from the ai/ directory
from pathlib import Path
env_path = Path(__file__).parent / ".env"
root_env_path = Path(__file__).parent.parent / ".env"
if env_path.exists():
    from dotenv import load_dotenv
    load_dotenv(env_path)
    print(f"✅ Loaded .env from {env_path}")
elif root_env_path.exists():
    from dotenv import load_dotenv
    load_dotenv(root_env_path)
    print(f"✅ Loaded .env from {root_env_path}")

# Make sure ai/ is importable as a package
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

TEST_PATIENT_ID = "test_patient_999"  # Isolated test — won't touch real data

# ── Sample medical records ─────────────────────────────────────────────────────
SAMPLE_RECORDS = [
    {
        "title": "Complete Blood Count — Jan 2025",
        "type": "LAB_REPORT",
        "date": "2025-01-15",
        "ai_analysis": (
            "Haemoglobin is low at 10.2 g/dL (ref 12-16), suggesting mild anaemia. "
            "WBC is normal at 7.5 × 10³/μL. Platelets are normal."
        ),
        "structured_tests": [
            {"test_name": "Haemoglobin", "value": "10.2", "unit": "g/dL",
             "status": "LOW", "reference_range": "12.0 - 16.0"},
            {"test_name": "WBC Count", "value": "7.5", "unit": "×10³/μL",
             "status": "NORMAL", "reference_range": "4.0 - 11.0"},
            {"test_name": "Platelet Count", "value": "220", "unit": "×10³/μL",
             "status": "NORMAL", "reference_range": "150 - 400"},
        ],
    },
    {
        "title": "Lipid Panel — Feb 2025",
        "type": "LAB_REPORT",
        "date": "2025-02-20",
        "ai_analysis": (
            "Total Cholesterol is elevated at 220 mg/dL (ref < 200). "
            "LDL is borderline high at 145 mg/dL. HDL is low at 38 mg/dL."
        ),
        "structured_tests": [
            {"test_name": "Total Cholesterol", "value": "220", "unit": "mg/dL",
             "status": "HIGH", "reference_range": "< 200"},
            {"test_name": "LDL Cholesterol", "value": "145", "unit": "mg/dL",
             "status": "BORDERLINE HIGH", "reference_range": "< 130"},
            {"test_name": "HDL Cholesterol", "value": "38", "unit": "mg/dL",
             "status": "LOW", "reference_range": "> 60"},
        ],
    },
]

PASS = "\033[92m✅ PASS\033[0m"
FAIL = "\033[91m❌ FAIL\033[0m"

def section(title):
    print(f"\n{'─'*60}")
    print(f"  {title}")
    print(f"{'─'*60}")


# ─────────────────────────────────────────────────────────────────────────────
# STEP 1 — Chunker
# ─────────────────────────────────────────────────────────────────────────────
def test_chunker():
    section("STEP 1 — Chunker")
    from ai.rag.chunker import chunk_medical_records
    chunks, metas = chunk_medical_records(SAMPLE_RECORDS)
    print(f"  Records : {len(SAMPLE_RECORDS)}")
    print(f"  Chunks  : {len(chunks)}")
    for i, (c, m) in enumerate(zip(chunks, metas)):
        print(f"  [{i}] [{m['chunk_type']:8}] {m['title'][:40]} | preview: {c[:60].replace(chr(10),' ')}")
    assert len(chunks) > 0, "Chunker produced 0 chunks"
    print(f"  {PASS}")
    return chunks, metas


# ─────────────────────────────────────────────────────────────────────────────
# STEP 2 — Embedder
# ─────────────────────────────────────────────────────────────────────────────
def test_embedder(chunks):
    section("STEP 2 — Embedder")
    from ai.rag.embedder import embed_texts, embed_query
    embeddings = embed_texts(chunks)
    print(f"  Embed shape  : {embeddings.shape}")
    assert embeddings.shape == (len(chunks), 384), f"Expected ({len(chunks)}, 384), got {embeddings.shape}"

    q_vec = embed_query("What is my haemoglobin level?")
    print(f"  Query shape  : {q_vec.shape}")
    assert q_vec.shape == (1, 384)
    print(f"  {PASS}")


# ─────────────────────────────────────────────────────────────────────────────
# STEP 3 — Index Store (build + search)
# ─────────────────────────────────────────────────────────────────────────────
def test_index_store(chunks, metas):
    section("STEP 3 — Index Store (build + search)")
    from ai.rag.index_store import rebuild_patient_index, search_index, patient_index_exists

    rebuild_patient_index(TEST_PATIENT_ID, chunks, metas)
    print(f"  Index created : {patient_index_exists(TEST_PATIENT_ID)}")
    assert patient_index_exists(TEST_PATIENT_ID)

    results = search_index(TEST_PATIENT_ID, "haemoglobin anaemia", top_k=3)
    print(f"  Search results: {len(results)}")
    for r in results:
        print(f"    score={r['score']:.3f} | type={r.get('chunk_type')} | {r.get('text','')[:60].replace(chr(10),' ')}")
    assert len(results) > 0, "Search returned 0 results"
    print(f"  {PASS}")
    return results


# ─────────────────────────────────────────────────────────────────────────────
# STEP 4 — Grader
# ─────────────────────────────────────────────────────────────────────────────
def test_grader(results):
    section("STEP 4 — Relevance Grader (Groq LLM)")
    from ai.rag.grader import grade_relevance

    # Test RELEVANT case
    texts = [r["text"] for r in results]
    grade = grade_relevance("What is my haemoglobin level?", texts)
    print(f"  Grade for haemoglobin query : {grade}")
    assert grade in ("RELEVANT", "PARTIAL"), f"Expected RELEVANT/PARTIAL, got {grade}"

    # Test IRRELEVANT case
    grade_irr = grade_relevance("What is the weather like today?", texts)
    print(f"  Grade for unrelated query   : {grade_irr}")
    assert grade_irr in ("IRRELEVANT", "PARTIAL")

    print(f"  {PASS}")


# ─────────────────────────────────────────────────────────────────────────────
# STEP 5 — Full corrective_rag()
# ─────────────────────────────────────────────────────────────────────────────
def test_corrective_rag():
    section("STEP 5 — Full corrective_rag() pipeline")
    from ai.rag.crag import corrective_rag

    history = [
        {"role": "user", "content": "Hi, I have some blood reports."},
        {"role": "assistant", "content": "Hello! I can help you understand your blood reports."},
    ]

    questions = [
        ("Relevant Q", "What is my haemoglobin level and is it normal?"),
        ("Irrelevant Q", "What is the capital of France?"),
        ("Partial Q",    "Tell me about my heart health."),
    ]

    for label, q in questions:
        print(f"\n  [{label}] Q: {q}")
        ans, eval_metrics = corrective_rag(TEST_PATIENT_ID, q, chat_history=history, top_k=5)
        print(f"  A: {ans[:180].replace(chr(10), ' ')}...")
        print(f"  Eval: {eval_metrics}")
        assert isinstance(ans, str) and len(ans) > 5, "Empty/invalid answer"
        assert isinstance(eval_metrics, dict), "Evaluation metrics should be a dictionary"

    print(f"\n  {PASS}")


# ─────────────────────────────────────────────────────────────────────────────
# STEP 6 — ai.py entry-point with patient_id (the actual backend path)
# ─────────────────────────────────────────────────────────────────────────────
def test_chat_entry_point():
    section("STEP 6 — chat_with_rognidhi() routes to cRAG")
    from ai.ai import chat_with_rognidhi

    medical_data = SAMPLE_RECORDS  # passed by views.py but cRAG ignores it when index exists
    history = []

    q = "My haemoglobin was 10.2 last time. Is that a concern?"
    print(f"  Q: {q}")
    ans, eval_metrics = chat_with_rognidhi(
        medical_data=medical_data,
        chat_history=history,
        new_question=q,
        patient_id=TEST_PATIENT_ID,
    )
    print(f"  A: {ans[:250].replace(chr(10), ' ')}...")
    print(f"  Eval: {eval_metrics}")
    assert isinstance(ans, str) and len(ans) > 10
    assert isinstance(eval_metrics, dict), "Evaluation metrics should be a dictionary"
    print(f"\n  {PASS}")


# ─────────────────────────────────────────────────────────────────────────────
# CLEANUP — remove test index files
# ─────────────────────────────────────────────────────────────────────────────
def cleanup():
    section("CLEANUP — removing test index files")
    import os
    index_dir = Path(__file__).parent / "rag" / "indexes"
    for suffix in (".faiss", ".pkl"):
        f = index_dir / f"{TEST_PATIENT_ID}{suffix}"
        if f.exists():
            os.remove(f)
            print(f"  Removed {f.name}")
    print(f"  {PASS}")


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    try:
        chunks, metas = test_chunker()
        test_embedder(chunks)
        results = test_index_store(chunks, metas)
        test_grader(results)
        test_corrective_rag()
        test_chat_entry_point()
        cleanup()

        print(f"\n{'='*60}")
        print(f"  ALL TESTS PASSED ✅")
        print(f"{'='*60}\n")
        sys.exit(0)

    except Exception as e:
        import traceback
        print(f"\n{'='*60}")
        print(f"  TEST FAILED ❌")
        print(f"  Error: {e}")
        traceback.print_exc()
        print(f"{'='*60}\n")
        sys.exit(1)
