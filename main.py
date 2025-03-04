from fastapi import FastAPI, UploadFile, File
import whisper
import os
import requests
from groq import Groq
import json

app = FastAPI()
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

print("Loading Whisper model...")
model = whisper.load_model("small")
print("Whisper model loaded successfully!")

# Set up Groq client
client = Groq(api_key="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")

# Translation APIs
def translate_to_english(text):
    try:
        response = requests.post('http://10.2.1.130:10000/tn_2_en', params={"text": text})
        return response.text if response.status_code == 200 else None
    except Exception as e:
        print(f"Translation to English failed: {e}")
        return None

def translate_to_tunisian(text):
    try:
        response = requests.post('http://10.2.1.130:10000/en_2_tn', params={"text": text})
        if response.status_code == 200:
            # Parse JSON and extract the "message" field
            data = response.json()
            return data.get("message", response.text)  # Extract "message" or fallback to raw text
        return None
    except Exception as e:
        print(f"Translation to Tunisian failed: {e}")
        return None

# Groq enhancement functions
def enhance_tunisian_translation(original_english, tunisian_translation):
    prompt = f"""
    Here is an original description in English: "{original_english}".
    And here is its Tunisian Arabic translation: "{tunisian_translation}".
    Please check if the translation is accurate. If it is, respond with "Translation is accurate."
    If not, provide a better translation in the format: "Improved translation: [your improved translation]."
    """
    try:
        chat_completion = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="deepseek-r1-distill-llama-70b",  # Adjust if needed
        )
        response = chat_completion.choices[0].message.content.strip()
        if "Translation is accurate" in response:
            return tunisian_translation
        elif "Improved translation:" in response:
            return response.split("Improved translation:")[1].strip()
        else:
            print(f"Unexpected Groq response for Tunisian: {response}")
            return tunisian_translation  # Fallback
    except Exception as e:
        print(f"Groq enhancement for Tunisian failed: {e}")
        return tunisian_translation  # Fallback

def enhance_english_translation(original_tunisian, english_translation):
    prompt = f"""
    Here is an original description in Tunisian Arabic: "{original_tunisian}".
    And here is its English translation: "{english_translation}".
    Please check if the translation is accurate. If it is, respond with "Translation is accurate."
    If not, provide a better translation in the format: "Improved translation: [your improved translation]."
    """
    try:
        chat_completion = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="deepseek-r1-distill-llama-70b",  # Adjust if needed
        )
        response = chat_completion.choices[0].message.content.strip()
        if "Translation is accurate" in response:
            return english_translation
        elif "Improved translation:" in response:
            return response.split("Improved translation:")[1].strip()
        else:
            print(f"Unexpected Groq response for English: {response}")
            return english_translation  # Fallback
    except Exception as e:
        print(f"Groq enhancement for English failed: {e}")
        return english_translation  # Fallback

@app.post("/upload/english")
async def upload_audio_english(file: UploadFile = File(...)):
    try:
        print(f"Received English file: {file.filename}, size: {file.size}")
        file_path = os.path.join(UPLOAD_DIR, file.filename)
        with open(file_path, "wb") as buffer:
            buffer.write(await file.read())
        print(f"File saved to: {file_path}")
        
        result = model.transcribe(file_path, language="en")
        english_text = result["text"]
        print(f"English transcription: {english_text}")
        
        initial_tunisian = translate_to_tunisian(english_text)
        print(f"Initial Tunisian translation: {initial_tunisian}")
        enhanced_tunisian = enhance_tunisian_translation(english_text, initial_tunisian) if initial_tunisian else None
        print(f"Enhanced Tunisian translation: {enhanced_tunisian}")
        
        os.remove(file_path)
        return {"transcription": english_text, "translation": enhanced_tunisian or "Translation failed"}
    except Exception as e:
        print(f"Error processing English request: {str(e)}")
        return {"error": str(e)}

@app.post("/upload/tunisian")
async def upload_audio_tunisian(file: UploadFile = File(...)):
    try:
        print(f"Received Tunisian file: {file.filename}, size: {file.size}")
        file_path = os.path.join(UPLOAD_DIR, file.filename)
        with open(file_path, "wb") as buffer:
            buffer.write(await file.read())
        print(f"File saved to: {file_path}")
        
        result = model.transcribe(file_path, language="ar")
        tunisian_text = result["text"]
        print(f"Tunisian transcription: {tunisian_text}")
        
        initial_english = translate_to_english(tunisian_text)
        print(f"Initial English translation: {initial_english}")
        enhanced_english = enhance_english_translation(tunisian_text, initial_english) if initial_english else None
        print(f"Enhanced English translation: {enhanced_english}")
        
        os.remove(file_path)
        return {"transcription": tunisian_text, "translation": enhanced_english or "Translation failed"}
    except Exception as e:
        print(f"Error processing Tunisian request: {str(e)}")
        return {"error": str(e)}