from fastapi import FastAPI, UploadFile, File
import whisper
import os
import requests
from groq import Groq
import re
from vosk import Model, KaldiRecognizer
import wave
from pydub import AudioSegment
import json

app = FastAPI()
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Load Whisper model for Tunisian transcription
print("Loading Whisper model...")
whisper_model = whisper.load_model("small")
print("Whisper model loaded successfully!")

# Load Vosk model for English transcription
MODEL_DIR = "C:/Users/MSI/Downloads/vosk-model/vosk-model"  # Ensure this is an English model
vosk_model = Model(MODEL_DIR)
print("Vosk model loaded successfully!")

# Set up Groq client
client = Groq(api_key="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")

# Helper function to detect foreign (English/French) words
def contains_foreign_words(text):
    english_french_pattern = r'\b[a-zA-Zéèêëàâîïôûùç]+\b'
    return re.findall(english_french_pattern, text)

# Function to translate foreign words in Tunisian text to Tunisian Arabic
def check_and_translate_with_llm(transcript):
    words_to_translate = contains_foreign_words(transcript)
    print(f"Foreign words to translate: {words_to_translate}")
    
    if not words_to_translate:
        return transcript
    
    words_list = ", ".join(words_to_translate)
    prompt = f"""
    I have a text in Tunisian Arabic mixed with some French and English words.
    Here is the text: "{transcript}"
    
    These words need to be translated into Tunisian Arabic: {words_list}
    
    Please provide a translation for each word in the format:  
    "word1 → translated_word1, word2 → translated_word2, ..."
    
    Do **not** translate the whole text, only these words.
    """
    try:
        chat_completion = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="deepseek-r1-distill-llama-70b",
        )
        response = chat_completion.choices[0].message.content.strip()
        
        translation_dict = {}
        for pair in response.split(","):
            parts = pair.strip().split("→")
            if len(parts) == 2:
                translation_dict[parts[0].strip()] = parts[1].strip()
        
        translated_text = transcript
        for word, translated_word in translation_dict.items():
            translated_text = translated_text.replace(word, translated_word)
        
        return translated_text
    except Exception as e:
        print(f"LLM request failed: {e}")
        return transcript

# Translation APIs
def translate_to_english(text):
    try:
        response = requests.post('http://10.2.1.130:10000/tn_2_en', params={"text": text})
        if response.status_code == 200:
            data = response.json()
            return data.get("message", response.text)
        return None
    except Exception as e:
        print(f"Translation to English failed: {e}")
        return None

def translate_to_tunisian(text):
    try:
        response = requests.post('http://10.2.1.130:10000/en_2_tn', params={"text": text})
        if response.status_code == 200:
            data = response.json()
            return data.get("message", response.text)
        return None
    except Exception as e:
        print(f"Translation to Tunisian failed: {e}")
        return None

import re

def enhance_tunisian_translation(original_english, tunisian_translation):
    prompt = f"""
        You are an expert translator fluent in both Tunisian Arabic and English, with a deep understanding of cultural nuances. Your task is to evaluate the accuracy and naturalness of a Tunisian Arabic translation of an English text.

        **Instructions**:
        - Evaluate the translation based on:
        - Accuracy: Does it faithfully convey the meaning of the original English text?
        - Grammar and Fluency: Is the Tunisian Arabic grammatically correct and fluent?
        - Cultural Nuances: Does it appropriately handle idiomatic expressions or cultural references specific to Tunisian Arabic?
        - If the translation is accurate, grammatically correct, fluent, and culturally appropriate, respond with: "Translation is accurate."
        - If there are any inaccuracies, grammatical errors, or cultural missteps, or if the translation can be improved for better fluency, respond with: "Improved translation: [your improved translation]."

        **Example**:
        - Original English: "Break a leg!"
        - Tunisian Arabic Translation: "كسّر رجلك!" (which is a literal translation and not idiomatic)
        - Improved translation: "بالتوفيق!" (which is the culturally appropriate way to wish someone good luck in Tunisian Arabic)

        **Now, evaluate the following**:
        Original English: "{original_english}"
        Tunisian Arabic Translation: "{tunisian_translation}"
    """
    try:
        chat_completion = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="Mistral-Saba-24b",
        )
        response = chat_completion.choices[0].message.content.strip()
        if "Translation is accurate" in response:
            return tunisian_translation
        elif "Improved translation:" in response:
            return response.split("Improved translation:")[1].strip()
        else:
            print(f"Unexpected Groq response for English: {response}")
            return tunisian_translation
    except Exception as e:
        print(f"Groq enhancement for English failed: {e}")
        return tunisian_translation

def enhance_english_translation(original_tunisian, english_translation):
    prompt = f"""
        You are an expert translator fluent in both English and Tunisian Arabic, with extensive knowledge of traditional cultural terminology and expressions. Your task is to evaluate and, if necessary, improve the English translation of a Tunisian Arabic text, paying special attention to cultural and traditional terms.

        **Instructions**:
        1. **Meaning & Accuracy**: Ensure the translation accurately conveys the full meaning of the original Tunisian Arabic text.
        2. **Grammar & Naturalness**: Confirm that the English translation is grammatically correct and reads naturally for native English speakers.
        3. **Cultural & Idiomatic Nuances**: 
        - Identify any cultural or traditional terms and ensure they are handled appropriately:
            - For terms like "جبة تونسية" (a traditional Tunisian garment), use "jubbah" or "Tunisian jubbah."
            - For "الشاشية" (traditional headwear), use "chachiya" or "Tunisian chachiya."
            - Avoid literal translations that might lead to misunderstandings (e.g., translating "جبة" as "cheese").
        - If a term is best left in its original form, retain it in Arabic and provide a parenthetical explanation or transliteration, e.g., "شاشية (chachiya, a traditional Tunisian hat)."
        4. **Alphabet Requirement**: Ensure all English words are written in the Latin alphabet.
        5. **Response Format**:
        - If the translation is accurate, grammatically correct, natural, and culturally appropriate, respond with exactly: "Translation is accurate."
        - If improvements are needed, respond with exactly: "Improved translation: [your improved translation]." Do not add extra commentary.

        **Example**:
        - Original Tunisian Arabic: "أنا لابس جبة تونسية."
        - English Translation: "I am wearing Tunisian cheese."
        - Improved translation: "I am wearing a Tunisian jubbah (a traditional garment)."

        **Now, evaluate the following:**
        Original Tunisian Arabic: "{original_tunisian}"
        English Translation: "{english_translation}"
    """
    try:
        chat_completion = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="Mistral-Saba-24b",
        )
        response = chat_completion.choices[0].message.content.strip()
        if response == "Translation is accurate.":
            return english_translation
        else:
            # Use regex to extract improved translation if present.
            match = re.search(r'Improved translation:\s*(.*)', response)
            if match:
                return match.group(1).strip()
            else:
                print(f"Unexpected response: {response}")
                return english_translation
    except Exception as e:
        print(f"Enhancement process failed: {e}")
        return english_translation

# Endpoint for English audio transcription using Vosk
@app.post("/upload/tunisian")
async def upload_audio_tunisian(file: UploadFile = File(...)):
    try:
        print(f"Received Tunisan file: {file.filename}, size: {file.size}")
        file_path = os.path.join(UPLOAD_DIR, file.filename)
        with open(file_path, "wb") as buffer:
            buffer.write(await file.read())
        print(f"File saved to: {file_path}")
        
        # Convert audio to WAV format (mono, 16kHz) for Vosk
        audio = AudioSegment.from_file(file_path)
        audio = audio.set_channels(1).set_frame_rate(16000)
        wav_path = os.path.join(UPLOAD_DIR, "temp_english.wav")
        audio.export(wav_path, format="wav")
        
        # Transcribe using Vosk
        with wave.open(wav_path, "rb") as wf:
            rec = KaldiRecognizer(vosk_model, wf.getframerate())
            while True:
                data = wf.readframes(4000)
                if len(data) == 0:
                    break
                rec.AcceptWaveform(data)
            result = json.loads(rec.FinalResult())
            tunisian_text = result["text"]
            tunisian_text = check_and_translate_with_llm(tunisian_text)
        
        print(f"Tunisan transcription: {tunisian_text}")
        
        # Translate and enhance
        initial_english = translate_to_english(tunisian_text)
        print(f"Initial English translation: {initial_english}")
        enhanced_english = enhance_english_translation(tunisian_text, initial_english) if initial_english else None
        print(f"Enhanced English translation: {enhanced_english}")
        
        # Clean up temporary files
        os.remove(file_path)
        os.remove(wav_path)
        
        return {"transcription": tunisian_text, "translation": enhanced_english or "Translation failed"}
    except Exception as e:
        print(f"Error processing English request: {str(e)}")
        return {"error": str(e)}

# Endpoint for Tunisian audio transcription using Whisper
@app.post("/upload/english")
async def upload_audio_english(file: UploadFile = File(...)):
    try:
        print(f"Received English file: {file.filename}, size: {file.size}")
        file_path = os.path.join(UPLOAD_DIR, file.filename)
        with open(file_path, "wb") as buffer:
            buffer.write(await file.read())
        print(f"File saved to: {file_path}")
        
        # Transcribe using Whisper
        result = whisper_model.transcribe(file_path, language="en")
        english_text = result["text"]
        print(f"Initial English transcription: {english_text}")
        
        # Translate and enhance
        initial_tunisian = translate_to_tunisian(english_text)
        print(f"Initial Tunisian translation: {initial_tunisian}")
        enhanced_tunisian = enhance_tunisian_translation(english_text, initial_tunisian) if initial_tunisian else None
        print(f"Enhanced Tunisian translation: {enhanced_tunisian}")
        
        # Clean up
        os.remove(file_path)
        return {"transcription": english_text, "translation": enhanced_tunisian or "Translation failed"}
    except Exception as e:
        print(f"Error processing Tunisian request: {str(e)}")
        return {"error": str(e)}