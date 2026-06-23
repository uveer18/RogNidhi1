import os
import json
import logging
from google import genai
from groq import Groq

logger = logging.getLogger(__name__)

_gemini_client = None
_groq_client = None

def _get_gemini_client():
    global _gemini_client
    if _gemini_client is None:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY is not set.")
        _gemini_client = genai.Client(api_key=api_key)
    return _gemini_client

def _get_groq_client():
    global _groq_client
    if _groq_client is None:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise ValueError("GROQ_API_KEY is not set.")
        _groq_client = Groq(api_key=api_key)
    return _groq_client

def build_prompt(text: str, context_hint: str = "", uploaded_date: str = None) -> str:
    prior_block = ""
    if context_hint:
        prior_block = f"""PRIOR PATIENT CONTEXT (from existing records — use to resolve ambiguous values/units):
{context_hint}

"""
    date_hint = f"For your awareness, the user explicitly tagged this document with the date: {uploaded_date}. Use this as the report date if you cannot find one in the text." if uploaded_date else ""
    return f"""
{prior_block}Act as an expert Medical Data Specialist. {date_hint}
Analyze the provided OCR text and extract the document metadata and all laboratory test results into a structured JSON object.

RULES:
1. Normalization: Standardize test names (e.g., 'Hb' -> 'Haemoglobin', 'WBC' -> 'Total White Blood Cell Count').
2. Context: Ensure the 'date' is extracted for every row. If not found, use the report generation date.
3. Data Integrity: Keep 'value' as a string (don't remove commas here, let the logic handle it). Ensure 'reference_range' includes the full string.
4. Tables: If the OCR has merged columns, logically separate the Test Name from the Finding.

SCHEMA:
{{
  "document_title": "The name of the report (e.g., Complete Blood Count, Lipid Panel, Prescription)",
  "document_type": "LAB_REPORT or PRESCRIPTION or DISCHARGE_SUMMARY or OTHER",
  "patient": {{
    "name": "optional",
    "age": "number",
    "gender": "male/female/other",
    "patient_id": "unique identifier"
    }},
  "doctor": {{
    "name": "",
    "registration_number": "",
    "specialization": ""
    }},
  "lab": {{
    "name": "",
    "address": "",
    "contact": ""
    }}, 
  "tests": [
    {{
      "test_name": "Full clinical name",
      "category": "Hematology / Biochemistry / Hormone / Imaging / etc.",
      "method": "ELISA / PCR / Automated Analyzer",
      "value": "Numeric or text value",
      "unit": "Standard unit (e.g., mg/dL, %)",
      "reference_range": "The exact range provided",
      "date": "YYYY-MM-DD"
    }}
  ]
  "report_date": "YYYY-MM-DD"
}}

TEXT TO PROCESS:
{text}
"""

def extract_with_gemini(text: str, model_name: str, context_hint: str = "", uploaded_date: str = None):
    logger.info(f"Attempting JSON extraction using {model_name}...")
    prompt = build_prompt(text, context_hint, uploaded_date)
    try:
        client = _get_gemini_client()
        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config={"temperature": 0.1, "response_mime_type": "application/json"}
        )
        output = response.text.strip()
        
        if "```json" in output:
            output = output.split("```json")[1].split("```")[0].strip()
            
        result = json.loads(output) if output else None
        if result:
            logger.info(f"Success. {model_name} extracted the structured data.")
        return result

    except Exception as e:
        error_msg = str(e)
        if "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg:
            logger.warning(f"{model_name} quota exhausted.")
        else:
            logger.error(f"{model_name} failed with error: {error_msg[:100]}...")
        return None

def extract_with_groq(text: str, context_hint: str = "", uploaded_date: str = None):
    logger.info("Attempting fallback using Groq (llama-3.3-70b-versatile)...")
    prompt = build_prompt(text, context_hint, uploaded_date)
    
    try:
        client = _get_groq_client()
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are a medical data extractor. Output ONLY valid JSON matching the exact schema."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"},
            temperature=0.1
        )
        
        output = response.choices[0].message.content
        logger.info("Success. Groq fallback extracted the structured data.")
        return json.loads(output)

    except Exception as e:
        logger.error(f"Groq Fallback Error: {e}")
        return {"document_title": "Unknown Document", "document_type": "OTHER", "tests": []}

def extract_structured(text: str, context_hint: str = "", uploaded_date: str = None):
    data = extract_with_gemini(text, "gemini-2.5-flash", context_hint, uploaded_date)
    if data: return data

    data = extract_with_gemini(text, "gemini-3-flash-preview", context_hint, uploaded_date)
    if data: return data

    return extract_with_groq(text, context_hint, uploaded_date)

def _smart_trim(text: str, max_chars: int = 8_000) -> str:
    """
    Intelligently trims OCR text to ~max_chars to minimize LLM token cost.

    Strategy for medical PDFs:
    - Keep the first HEAD_CHARS (dates, patient name, doctor, lab name live here).
    - From the remaining body, keep only lines that look like medical data rows
      (contain numbers, units, '/', ranges — i.e. actual test data).
    - Never blindly truncate mid-sentence; work line-by-line.
    """
    if len(text) <= max_chars:
        return text

    head_chars = max_chars // 3        # ~2 700 chars for the header block
    body_budget = max_chars - head_chars

    head = text[:head_chars]
    body_lines = text[head_chars:].splitlines()

    import re
    # Heuristic: lines with numeric values, units or reference ranges are data rows
    DATA_PAT = re.compile(
        r'(\d+\.?\d*\s*[-–]\s*\d+\.?\d*'   # range: 4.5 - 11.0
        r'|\d+\.?\d+\s*[a-zA-Z/%]+)'         # value+unit: 13.5 g/dL
    )
    selected: list[str] = []
    used = 0
    for line in body_lines:
        line = line.strip()
        if not line:
            continue
        # Always keep short lines (headers / section labels)
        if len(line) < 80 or DATA_PAT.search(line):
            if used + len(line) + 1 > body_budget:
                break
            selected.append(line)
            used += len(line) + 1

    trimmed = head + "\n" + "\n".join(selected)
    logger.info(
        f"_smart_trim: {len(text)} → {len(trimmed)} chars "
        f"({100 * len(trimmed) // len(text)}% of original)."
    )
    return trimmed


MAX_OCR_CHARS = 8_000   # ≈ 2 000 tokens — safe limit for all LLMs in the chain

def extract_limited(text: str, context_hint: str = "", uploaded_date: str = None) -> dict:
    """
    Entry-point for structured extraction.
    Proactively minimizes token cost for large PDFs via _smart_trim,
    then falls through the Gemini → Groq chain.
    """
    original_len = len(text)
    logger.info(f"Received OCR text of length: {original_len} characters.")

    # Proactive trim — never send more than MAX_OCR_CHARS to any LLM
    trimmed = _smart_trim(text, max_chars=MAX_OCR_CHARS)

    try:
        return extract_structured(trimmed, context_hint, uploaded_date)
    except Exception as e:
        # Hard fallback: blind head-truncation to 4 000 chars
        logger.warning(
            f"Extraction failed on smart-trimmed text ({len(trimmed)} chars). "
            f"Hard-truncating to 4000 chars and retrying. Error: {e}"
        )
        return extract_structured(trimmed[:4_000], context_hint, uploaded_date)