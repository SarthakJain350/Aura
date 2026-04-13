import json
import os
try:
    from textblob import TextBlob
except ImportError:
    TextBlob = None

MOOD_KEYWORDS = {
    'happy': ['happy', 'joy', 'great', 'amazing', 'good', 'excited', 'cheerful', 'wonderful', 'fantastic', 'awesome'],
    'sad': ['sad', 'depressed', 'down', 'cry', 'crying', 'upset', 'unhappy', 'lonely', 'heartbroken', 'miss'],
    'calm': ['calm', 'relax', 'chill', 'peaceful', 'quiet', 'breathe', 'slow', 'easy', 'zen', 'rest'],
    'focused': ['focus', 'study', 'concentrate', 'work', 'productive', 'homework', 'exam', 'coding', 'read'],
    'energetic': ['energy', 'pump', 'hype', 'workout', 'gym', 'run', 'dance', 'party', 'fired up', 'lets go'],
    'stressed': ['stressed', 'stress', 'anxious', 'anxiety', 'nervous', 'overwhelmed', 'pressure', 'panic', 'worried'],
    'angry': ['angry', 'mad', 'furious', 'annoyed', 'frustrated', 'hate', 'irritated', 'rage'],
    'tired': ['tired', 'sleepy', 'exhausted', 'drained', 'bored', 'lazy', 'slow', 'heavy']
}

def _get_default_mood():
    profile_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'user_profile.json')
    try:
        with open(profile_path, 'r', encoding='utf-8') as f:
            profile = json.load(f)
            return profile.get('default_mood', 'calm')
    except Exception:
        return 'calm'

def detect_by_keyword(text):
    text = text.lower()
    for mood, keywords in MOOD_KEYWORDS.items():
        for kw in keywords:
            if kw in text:
                return mood
    return None

def detect_by_sentiment(text):
    if TextBlob is None:
        return _get_default_mood()
        
    polarity = TextBlob(text).sentiment.polarity
    if polarity > 0.3:
        return 'happy'
    elif polarity > 0.0:
        return 'calm'
    elif polarity < -0.4:
        return 'sad'
    elif polarity < 0.0:
        return 'stressed'
    else:
        # exactly 0.0
        return _get_default_mood()

def detect_mood(text):
    if not text or not text.strip():
        return _get_default_mood()
        
    result = detect_by_keyword(text)
    if result is not None:
        return result
        
    return detect_by_sentiment(text)
