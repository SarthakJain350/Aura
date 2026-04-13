import json
import pyttsx3
import os

def speak(text):
    print(f"AURA: {text}")
    try:
        engine = pyttsx3.init()
        voices = engine.getProperty('voices')
        if len(voices) > 1:
            engine.setProperty('voice', voices[1].id)
        engine.setProperty('rate', 175)
        engine.setProperty('volume', 0.9)
        engine.say(text)
        engine.runAndWait()
    except Exception as e:
        print(f"[TTS Error: {e}]")

def get_dual_input(prompt_text):
    speak(prompt_text)
    
    # Try voice first
    try:
        from modules import voice_input
        print("(Listening for voice...)")
        # Initialize recognizer just in case
        voice_ans = voice_input.listen_for_command()
        if voice_ans and voice_ans.strip():
            print(f"(Heard: {voice_ans})")
            return voice_ans.lower().strip()
    except Exception as e:
        print(f"Voice input skipped or failed: {e}")
        
    # Keyboard fallback
    print("(Voice not detected. Please type your answer.)")
    ans = input("Your answer: ")
    return ans.lower().strip()

def run_onboarding():
    profile_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'user_profile.json')
    with open(profile_path, 'r', encoding='utf-8') as f:
        profile = json.load(f)
        
    if profile.get('onboarded', False):
        return
        
    speak("Hi! I am AURA. Let me get to know you before we begin.")
    
    mood = get_dual_input("How are you feeling right now? Say happy, sad, calm, focused, or energetic.")
    if mood:
        profile['default_mood'] = mood
        
    context = get_dual_input("When do you usually listen to music? Study, workout, sleep, or chill?")
    if context:
        profile['listening_context'] = context
        
    genre = get_dual_input("What kind of music do you like? Pop, lo-fi, rock, classical, or hip-hop?")
    if genre:
        profile['preferred_genre'] = genre
        
    profile['onboarded'] = True
    
    with open(profile_path, 'w', encoding='utf-8') as f:
        f.write(json.dumps(profile, indent=2))
        
    speak("Perfect. I have got you. Let us begin.")

if __name__ == "__main__":
    run_onboarding()
