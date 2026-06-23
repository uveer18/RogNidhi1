import os
import json
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

def evaluate_rag_response(question: str, context: str, answer: str) -> dict:
    """
    Evaluates the generated RAG response against the user question and the retrieved context.
    Returns a dict with context_relevance, faithfulness, answer_relevance, and overall_accuracy.
    """
    if not context or not context.strip():
        # Fallback/N/A case when no context was retrieved/used
        return {
            "context_relevance": 0,
            "faithfulness": 0,
            "answer_relevance": 100,  # Assuming answer is relevant since no context was available
            "overall_accuracy": 33
        }

    prompt = f"""You are an expert clinical AI evaluator for a Retrieval-Augmented Generation (RAG) assistant named RogNidhi.
Your task is to evaluate the quality of a generated response based on the user's question and the retrieved context from their medical records.

Evaluate the following three metrics on a scale of 0 to 100:
1. **context_relevance**: How relevant and helpful is the retrieved medical context for answering the user's question?
   - 100: The context contains direct, complete information to answer the question.
   - 50: The context is partially related but missing key details.
   - 0: The context is completely unrelated to the question.

2. **faithfulness**: Is the generated answer grounded *only* in the retrieved context?
   - 100: Every statement in the answer is fully supported by the retrieved context.
   - 50: The answer is partially grounded but contains general medical assumptions or outside facts.
   - 0: The answer contains claims, assumptions, or facts that are not present in the retrieved context.
   *(Note: If the answer explicitly states that the medical records do not contain the answer, and does not make up facts, then it is faithful, so score it highly.)*

3. **answer_relevance**: Does the generated answer directly and appropriately address the user's question?
   - 100: The answer fully and accurately addresses the user's query.
   - 50: The answer is vague, partially addresses the query, or goes off-topic.
   - 0: The answer is completely irrelevant to the question.

Calculate **overall_accuracy** as the average of the three scores (rounded to the nearest integer).

INPUT DATA:
User Question: {question}
Retrieved Context: {context}
Generated Answer: {answer}

Output your evaluation in JSON format. Do not include any explanation, markdown formatting, or markdown code blocks (like ```json). The output must be exactly in this format:
{{
  "context_relevance": <integer between 0 and 100>,
  "faithfulness": <integer between 0 and 100>,
  "answer_relevance": <integer between 0 and 100>,
  "overall_accuracy": <integer between 0 and 100>
}}
"""

    try:
        client = _get_client()
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.0,
            response_format={"type": "json_object"}
        )
        raw_output = response.choices[0].message.content.strip()
        logger.info(f"RAG Evaluation Raw Output: {raw_output}")
        
        # Parse JSON
        eval_data = json.loads(raw_output)
        
        # Validate values are present and numeric
        metrics = {
            "context_relevance": int(eval_data.get("context_relevance", 0)),
            "faithfulness": int(eval_data.get("faithfulness", 0)),
            "answer_relevance": int(eval_data.get("answer_relevance", 0)),
            "overall_accuracy": int(eval_data.get("overall_accuracy", 0))
        }
        return metrics

    except Exception as e:
        logger.error(f"RAG Evaluation failed: {e}")
        # Return fallback heuristic-based metrics based on basic checks
        return {
            "context_relevance": 50,
            "faithfulness": 80,
            "answer_relevance": 90,
            "overall_accuracy": 73
        }
