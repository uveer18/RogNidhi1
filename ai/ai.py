import logging
from .base.ocr import extract_text
from .base.structured import extract_limited
from .base.chat import detect_abnormal, generate_doctor_summary, generate_patient_summary
from .rag.crag import corrective_rag
from .rag.index_store import update_patient_index, patient_index_exists
from .rag.chunker import chunk_medical_records

logger = logging.getLogger(__name__)


def run_ai_pipeline(file_obj, filename: str, patient_id=None, uploaded_date=None) -> dict:
    try:
        logger.info(f"Starting AI pipeline for: {filename} (Date: {uploaded_date})")

        text = extract_text(file_obj, filename)
        if not text:
            return {"success": False, "error": "Could not extract text from the document. Please ensure the file is clear."}

        # ── RAG-augmented structuring: pull prior context if index exists ──────
        context_hint = ""
        if patient_id is not None and patient_index_exists(patient_id):
            try:
                from .rag.index_store import search_index
                prior_chunks = search_index(patient_id, text[:500], top_k=3)
                if prior_chunks:
                    context_hint = "\n\n".join(
                        c.get("text", "") for c in prior_chunks if c.get("text")
                    )
                    logger.info(f"RAG: injecting {len(prior_chunks)} prior chunks as context hint.")
            except Exception as e:
                logger.warning(f"RAG context hint failed (non-fatal): {e}")

        logger.info("Structuring data..")
        structured_output = extract_limited(text, context_hint, uploaded_date)

        if not isinstance(structured_output, dict):
            # If the LLM returned a raw list of tests instead of a structured dict
            if isinstance(structured_output, list):
                structured_output = {"tests": structured_output, "document_title": "Unknown", "document_type": "OTHER"}
            else:
                structured_output = {"tests": [], "document_title": "Unknown", "document_type": "OTHER"}
        
        doc_title = structured_output.get("document_title", "Medical Document")
        doc_type = structured_output.get("document_type", "OTHER")
        test_data = structured_output.get("tests", [])
        if not isinstance(test_data, list):
            test_data = [test_data]

        logger.info("Detecting abnormalities & generating summary...")
        enriched_tests = detect_abnormal(test_data)
        structured_output["tests"] = enriched_tests
        summary = generate_patient_summary(enriched_tests)

        timeline_date = structured_output.get("report_date")
        if not timeline_date:
            for test in enriched_tests:
                if test.get("date"):
                    timeline_date = test["date"]
                    break

        return {
            "success": True,
            "title": doc_title,                 
            "document_type": doc_type,         
            "extracted_data": structured_output, 
            "ai_summary": summary,             
            "timeline_date": timeline_date     
        }
        
    except Exception as e:
        logger.error(f"AI Pipeline crashed: {str(e)}")
        return {"success": False, "error": "An internal error occurred while processing the document."}


def chat_with_rognidhi(
    medical_data: list,
    chat_history: list,
    new_question: str,
    patient_id: str | int | None = None,
) -> tuple[str, dict | None]:
    """
    Main chat entry point.

    If patient_id is provided, uses Corrective RAG (FAISS retrieval + LLM grading).
    Falls back to direct LLM if patient_id is missing (graceful degradation).
    """
    if not new_question:
        return "Please ask a question.", None

    try:
        if patient_id is not None:
            logger.info(f"Using Corrective RAG for patient {patient_id}.")
            
            # ── Lazy rebuild if index is missing but data exists ────────────────
            if medical_data and not patient_index_exists(patient_id):
                logger.info(f"Index missing for patient {patient_id} — triggering lazy rebuild.")
                rebuild_patient_rag_index(patient_id, medical_data)

            recent_history = chat_history[-6:] if chat_history else []
            return corrective_rag(
                patient_id=patient_id,
                question=new_question,
                chat_history=recent_history,
            )
        else:
            # Fallback: no index available yet — use legacy direct LLM path
            logger.info("No patient_id provided — using legacy ask_rognidhi path.")
            from .base.chat import ask_rognidhi
            recent_history = chat_history[-6:] if chat_history else []
            ans = ask_rognidhi(medical_data, new_question, recent_history)
            
            # Evaluate fallback path if medical_data is available
            from .rag.eval import evaluate_rag_response
            context_str = str(medical_data) if medical_data else ""
            eval_metrics = evaluate_rag_response(new_question, context_str, ans)
            return ans, eval_metrics

    except Exception as e:
        logger.error(f"Chat Error: {e}")
        return "I'm having trouble analyzing your report right now. Please try again.", None
    

def get_doctor_brief(medical_data: list) -> str:
    if not medical_data:
        return "No structured data available for this report."

    try:
        logger.info("Generating Doctor Summary...")
        return generate_doctor_summary(medical_data)
    except Exception as e:
        logger.error(f"Doctor Summary Error: {e}")
        return "I'm having trouble generating clinical brief report right now. Please try again."


def update_patient_rag_index(patient_id: str | int, record: dict):
    """
    Incrementally add a SINGLE medical record to the patient's FAISS index.
    Call this after every successful document upload.

    Args:
        patient_id: Patient DB primary key.
        record:     A single record context dict (title, type, date, ai_analysis, structured_tests).
    """
    try:
        # Wrap the single record in a list for the chunker
        chunks, metas = chunk_medical_records([record])
        if chunks:
            update_patient_index(patient_id, chunks, metas)
            logger.info(f"RAG index updated for patient {patient_id}: +{len(chunks)} chunks.")
    except Exception as e:
        logger.error(f"Failed to update RAG index for patient {patient_id}: {e}")


def rebuild_patient_rag_index(patient_id: str | int, all_records: list[dict]):
    """
    Wipe and recreate the patient's FAISS index from their entire history.
    Call this after a document is deleted.

    Args:
        patient_id:  Patient DB primary key.
        all_records: List of all remaining record context dicts.
    """
    try:
        from .rag.index_store import rebuild_patient_index
        chunks, metas = chunk_medical_records(all_records)
        rebuild_patient_index(patient_id, chunks, metas)
        logger.info(f"RAG index rebuilt for patient {patient_id} with {len(chunks)} total chunks.")
    except Exception as e:
        logger.error(f"Failed to rebuild RAG index for patient {patient_id}: {e}")
