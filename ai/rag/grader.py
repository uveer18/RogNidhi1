import os
import re
import logging
from groq import Groq

logger = logging.getLogger(__name__)

_client = None

def _get_client():
    global _client
    if _client is None:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise ValueError("GROQ_API_KEY is not set.")
        _client = Groq(api_key=api_key)
    return _client

_VALID = {"RELEVANT", "PARTIAL", "IRRELEVANT"}


def grade_relevance(question: str, chunks: list[str]) -> str:
    """
    Grade whether the retrieved chunks are relevant to the question.

    Args:
        question: The user's question.
        chunks:   List of retrieved text chunks from the FAISS index.

    Returns:
        One of "RELEVANT", "PARTIAL", "IRRELEVANT".
    """
    if not chunks:
        return "IRRELEVANT"

    context_block = "\n\n---\n\n".join(chunks[:5])  # cap at 5 chunks for grader

    prompt = f"""You are a relevance classification engine. Your ONLY job is to decide whether the provided CONTEXT contains useful information to answer the QUESTION.

QUESTION:
{question}

CONTEXT:
{context_block}

CLASSIFICATION RULES:
- RELEVANT   → The context directly answers or substantially helps answer the question.
- PARTIAL    → The context is loosely related but incomplete or only partially helpful.
- IRRELEVANT → The context has nothing to do with the question.

Reply with EXACTLY one word — no punctuation, no explanation:
RELEVANT or PARTIAL or IRRELEVANT"""

    try:
        client = _get_client()
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
            max_tokens=5,
        )
        raw = response.choices[0].message.content.strip().upper()

        # Extract the first valid keyword even if the LLM added extra text
        match = re.search(r"\b(RELEVANT|PARTIAL|IRRELEVANT)\b", raw)
        if match:
            result = match.group(1)
            logger.info(f"Relevance grade: {result}")
            return result

        logger.warning(f"Grader returned unexpected output: {raw!r} — defaulting to PARTIAL")
        return "PARTIAL"

    except Exception as e:
        logger.error(f"Grader error: {e} — defaulting to PARTIAL")
        return "PARTIAL"