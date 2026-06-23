import os
import logging
from groq import Groq

from .index_store import search_index
from .grader import grade_relevance

logger = logging.getLogger(__name__)
_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

#SHARED
_PERSONA = """You are RogNidhi, a warm and clinically careful health assistant.
Explain medical information in very simple English — like talking to a 12-year-old.
Use short sentences. No markdown. No bold text. No jargon unless you immediately explain it.
NEVER diagnose. Always end serious concerns with: "Please speak with your doctor to confirm."
NEVER say "Don't worry" or "Great news" — stay calm and factual."""


def _build_context_block(retrieved: list[dict]) -> str:
    """Format retrieved chunks into a readable context block for the LLM."""
    parts = []
    seen = set()
    for item in retrieved:
        text = item.get("text", "")
        if text and text not in seen:
            seen.add(text)
            score = item.get("score", 0)
            meta  = f"[{item.get('title', '')} | {item.get('date', '')}]"
            parts.append(f"{meta}\n{text}")
    return "\n\n".join(parts)


def _generate(messages: list[dict]) -> str:
    try:
        resp = _client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            temperature=0.2,
        )
        return resp.choices[0].message.content.strip()
    except Exception as e:
        logger.error(f"Groq generation error: {e}")
        return "I'm having trouble generating a response right now. Please try again."


def _answer_relevant(question: str, context: str, chat_history: list) -> str:
    system_msg = (
        f"{_PERSONA}\n\n"
        "You have access to this patient's medical records below. "
        "Answer ONLY using information from these records. "
        "If the records don't contain enough detail, say so honestly.\n\n"
        f"PATIENT RECORDS:\n{context}"
    )
    messages = [{"role": "system", "content": system_msg}]
    if chat_history:
        messages.extend(chat_history[-6:])
    messages.append({"role": "user", "content": question})
    return _generate(messages)


def _answer_partial(question: str, context: str, chat_history: list) -> str:
    system_msg = (
        f"{_PERSONA}\n\n"
        "You have partial information from this patient's medical records. "
        "Use the records as a starting point but be transparent about gaps. "
        "Where records are incomplete, draw on general medical knowledge but "
        "clearly say 'Based on general knowledge…' to distinguish it.\n\n"
        f"PATIENT RECORDS (partial match):\n{context}"
    )
    messages = [{"role": "system", "content": system_msg}]
    if chat_history:
        messages.extend(chat_history[-6:])
    messages.append({"role": "user", "content": question})
    return _generate(messages)


def _answer_irrelevant(question: str, chat_history: list) -> str:
    system_msg = (
        f"{_PERSONA}\n\n"
        "The patient is asking a question that doesn't relate to their specific uploaded medical data. "
        "Your task is to respond naturally as RogNidhi.\n\n"
        "RULES:\n"
        "1. If they are just saying hello/goodbye or asking generic bot questions (who are you, what can you do?), "
        "respond warmly and naturally WITHOUT ANY DISCLAIMERS.\n"
        "2. If they are asking a HEALTH question that isn't in their records, start by saying: "
        "'Your medical records don't have specific information about this, but here is some general information:'\n"
        "3. Never say you 'don't have access' to their records — you DO have access, there just wasn't a match."
    )
    messages = [{"role": "system", "content": system_msg}]
    if chat_history:
        messages.extend(chat_history[-6:])
    messages.append({"role": "user", "content": question})
    return _generate(messages)


def corrective_rag(
    patient_id: str | int,
    question: str,
    chat_history: list | None = None,
    top_k: int = 5,
) -> tuple[str, dict]:
    """
    Full Corrective RAG pipeline.

    Args:
        patient_id:   Patient DB ID (used to look up the right FAISS index).
        question:     The user's question string.
        chat_history: List of message dicts [{"role": "user"/"assistant", "content": "..."}].
        top_k:        Number of chunks to retrieve from FAISS.

    Returns:
        Tuple of (Answer string, eval_metrics dict).
    """
    history = chat_history or []

    logger.info(f"CRAG pipeline started for patient {patient_id}.")

    retrieved = search_index(patient_id, question, top_k=top_k)

    chunk_texts = [r.get("text", "") for r in retrieved if r.get("text")]
    grade = grade_relevance(question, chunk_texts)
    logger.info(f"CRAG grade: {grade} | retrieved {len(retrieved)} chunks.")

    context = _build_context_block(retrieved)

    if grade == "RELEVANT":
        ans = _answer_relevant(question, context, history)
    elif grade == "PARTIAL":
        ans = _answer_partial(question, context, history)
    else:  
        ans = _answer_irrelevant(question, history)

    from .eval import evaluate_rag_response
    eval_metrics = evaluate_rag_response(question, context, ans)
    return ans, eval_metrics