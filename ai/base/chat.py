import os
import re
from groq import Groq
import logging

_client = None

def _get_client():
    global _client
    if _client is None:
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise ValueError("GROQ_API_KEY is not set.")
        _client = Groq(api_key=api_key)
    return _client

logger = logging.getLogger(__name__)

def clean_number(val_str: str):
    cleaned = str(val_str).replace(",", "").strip()
    try:
        return float(cleaned)
    except ValueError:
        return None

def parse_range(r: str):
    r_str = str(r).replace(",", "").strip()
    
    if "<" in r_str or "less" in r_str.lower():
        nums = re.findall(r"\d+\.?\d*", r_str)
        if nums: return 0.0, float(nums[0])
            
    if ">" in r_str or "greater" in r_str.lower():
        nums = re.findall(r"\d+\.?\d*", r_str)
        if nums: return float(nums[0]), float('inf')

    nums = re.findall(r"\d+\.?\d*", r_str)
    if len(nums) >= 2: return float(nums[0]), float(nums[1])
        
    return None, None

def detect_abnormal(data: list):
    logger.info(f"Running abnormality detection on {len(data)} extracted tests...")
    
    safe_data = []
    for item in data:
        if not isinstance(item, dict):
            continue
        
        val_str = item.get("value", "")
        range_str = item.get("reference_range", "")
        val = clean_number(val_str)

        if val is None:
            if val_str and not range_str:
                item["status"] = "INFO"
            else:
                item["status"] = "UNKNOWN"
            safe_data.append(item)
            continue

        low, high = parse_range(range_str)

        if low is None or high is None:
            item["status"] = "UNKNOWN"
        elif val < low:
            item["status"] = "LOW"
        elif val > high:
            item["status"] = "HIGH"
        else:
            item["status"] = "NORMAL"

        safe_data.append(item)

    logger.info("Abnormality detection complete.")
    return safe_data

def generate_patient_summary(data: list):
    logger.info("Generating Patient Summary via Groq...")
    abnormal = [d for d in data if d.get("status") in ["HIGH", "LOW"]]
    
    prompt = f"""
You are RogNidhi, a friendly and supportive health assistant.
Tone: Warm, empathetic, and very easy to understand. Maintain clinical safety: NEVER use overly cheerful phrases like "Don't worry" or "Great news."

Input Data:
{abnormal if abnormal else data}

Instructions:
1.  Overview: Start with a polite, professional greeting acknowledging the specific type of report you are looking at (e.g., "Hello! I've taken a look at your eye prescription.").
2.  Key Findings: If there are HIGH/LOW values, explain what they are using everyday words. If all values are NORMAL or UNKNOWN, simply state that the values were successfully extracted.
3.  Actionable Advice: Suggest simple, safe lifestyle steps (e.g., 'drink more water' or 'rest your eyes') if applicable.
4.  The 'Doctor' Rule: Always end by saying this is not a diagnosis and they must talk to their doctor.
5.  Constraints: No complex medical terms. No markdown bolding (**).

Output format:
- [Professional greeting and report acknowledgment]
- [Simple explanation of results]
- [Simple lifestyle suggestion]
- NOTE: [Disclaimer about seeing a doctor]
"""
    try:
        g_client = _get_client()
        response = g_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2
        )
        logger.info("Patient Summary generated successfully.")
        return response.choices[0].message.content.strip()
        
    except Exception as e:
        logger.error(f"Groq Chat Error (Patient Summary): {e}")
        return "I'm having trouble connecting to my summarization engine. Please try again."
    
def generate_doctor_summary(data: list):
    logger.info("Generating Doctor Summary via Groq...")
    abnormal = [d for d in data if d.get("status") in ["HIGH", "LOW"]]
    
    prompt = f"""
You are a Senior Clinical AI Assistant. Generate a concise Clinical Brief for an attending physician.
Tone: Highly professional, objective, and analytical. Use standard medical terminology.

Input Data:
{abnormal if abnormal else data}

Instructions:
1.  Summary of Findings: Immediately list all out-of-range parameters with values and reference deltas.
2.  Clinical Correlation: Suggest 2-3 common differential considerations based ONLY on the abnormal values.
3.  Critical Flags: Highlight any values that are severely outside normal limits (Panic Values).
4.  Format: Use a structured, bulleted list. 
5.  Constraints: No conversational filler. No "I hope this helps." No markdown bolding (**).

Output format:
- FINDINGS: [Test Name] ([Value] [Unit]) - [HIGH/LOW]
- DIFFERENTIALS: [Potential clinical considerations]
- RECOMMENDATION: [Next steps like 'Correlate clinically' or 'Follow-up tests']
"""
    try:
        g_client = _get_client()
        response = g_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1 
        )
        logger.info("Doctor Summary generated successfully.")
        return response.choices[0].message.content.strip()
        
    except Exception as e:
        logger.error(f"Groq Chat Error (Doctor Summary): {e}")
        return "I'm having trouble connecting to my summarization engine. Please try again."

def ask_rognidhi(data: list, question: str, chat_history: list = None):
    logger.info(f"RogNidhi Chatbot received question")
    prompt = f"""
You are RogNidhi, a friendly clinical assistant explaining lab results to a normal person.

Patient Data:
{data}

STRICT RESPONSE STYLE (MANDATORY):

Always follow this structure:

1. 
Explain the issue in one or two very simple sentences.

2. 
Explain using a real-life analogy or comparison.
Avoid medical words unless explained immediately.

3. 
Say clearly:
- mild / moderate / needs attention
- do NOT create fear

4. 
Give simple, practical steps (food, lifestyle, general care).
No prescriptions.

LANGUAGE RULES:
- Use very simple English (like explaining to a 12-year-old)
- Short sentences only
- Avoid all medical jargon unless explained
- If you use a term, explain it instantly

BAD EXAMPLE:
"Your erythrocyte sedimentation rate is elevated"

GOOD EXAMPLE:
"One of your tests shows some inflammation. That means your body might be dealing with irritation or stress."

TONE:
- Calm, reassuring, human
- Not robotic
- No long paragraphs

IMPORTANT:
- NEVER ask the user to simplify again
- ALWAYS respond in simple terms by default

SAFETY:
If asked for diagnosis, say only a doctor can confirm — at the end only.

No markdown. No bold text.
"""
    messages = [{"role": "system", "content": prompt}]
    
    if chat_history: messages.extend(chat_history)
    messages.append({"role": "user", "content": question})

    try:
        g_client = _get_client()
        response = g_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            temperature=0.2
        )
        logger.info("RogNidhi response generated successfully.")
        return response.choices[0].message.content.strip()
        
    except Exception as e:
        logger.error(f"Groq Chat Error: {e}")
        return "I'm having trouble connecting to my knowledge base. Please try again."