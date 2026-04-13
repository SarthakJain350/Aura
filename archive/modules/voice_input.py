import speech_recognition as sr
import pyttsx3

def speak(text):
    try:
        engine = pyttsx3.init()
        voices = engine.getProperty('voices')
        if len(voices) > 1:
            engine.setProperty('voice', voices[1].id)
        engine.setProperty('rate', 175)
        engine.setProperty('volume', 0.9)
        engine.say(text)
        engine.runAndWait()
    except Exception:
        pass

def listen_for_wake_word():
    recognizer = sr.Recognizer()
    try:
        microphone = sr.Microphone()
    except Exception:
        # Prevent crash if no mic
        return False

    with microphone as source:
        print("[AURA] Listening for wake word...")
        try:
            recognizer.adjust_for_ambient_noise(source, duration=1)
        except Exception:
            pass
            
        while True:
            try:
                # listen continuously
                audio = recognizer.listen(source, timeout=None, phrase_time_limit=3)
                text = recognizer.recognize_google(audio).lower()
                if "aura" in text:
                    print(f"[AURA] Wake word heard in: '{text}'")
                    speak("Yes, I am listening.")
                    return True
            except (sr.UnknownValueError, sr.WaitTimeoutError):
                pass
            except sr.RequestError:
                pass
            except Exception:
                # Handle all exceptions silently - never crash
                pass

def listen_for_command():
    recognizer = sr.Recognizer()
    try:
        microphone = sr.Microphone()
    except Exception:
        return ""

    with microphone as source:
        print("[AURA] Listening for command...")
        try:
            # timeout=6: max wait before speech, phrase_time_limit=6: max speech length
            audio = recognizer.listen(source, timeout=6, phrase_time_limit=6)
            text = recognizer.recognize_google(audio).lower()
            print(f"[AURA] Command heard: '{text}'")
            return text
        except (sr.WaitTimeoutError, sr.UnknownValueError, sr.RequestError):
            return ""
        except Exception:
            return ""

if __name__ == "__main__":
    if listen_for_wake_word():
        cmd = listen_for_command()
        print("Final cmd:", cmd)
