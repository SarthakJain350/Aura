import os
import json
from modules.voice_input import speak
import modules.player as player

def _get_profile_path():
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'user_profile.json')

def on_skip(song_path, mood):
    speak("Got it, skipping.")
    
    if not song_path:
        return
        
    profile_path = _get_profile_path()
    try:
        with open(profile_path, 'r', encoding='utf-8') as f:
            profile = json.load(f)
    except Exception:
        profile = {}

    weights = profile.get('song_weights', {})
    current_weight = weights.get(song_path, 0)
    weights[song_path] = max(0, current_weight - 1)
    profile['song_weights'] = weights
    
    profile_skip = profile.get('skip_count', 0)
    profile['skip_count'] = profile_skip + 1
    
    # Also update player's local skip count
    player.skip_count += 1

    with open(profile_path, 'w', encoding='utf-8') as f:
        f.write(json.dumps(profile, indent=2))

def on_full_listen(song_path, mood):
    speak("Glad you liked that one. I will remember it.")
    
    if not song_path:
        return
        
    profile_path = _get_profile_path()
    try:
        with open(profile_path, 'r', encoding='utf-8') as f:
            profile = json.load(f)
    except Exception:
        profile = {}

    weights = profile.get('song_weights', {})
    current_weight = weights.get(song_path, 0)
    new_weight = current_weight + 2
    weights[song_path] = new_weight
    profile['song_weights'] = weights
    
    favourites = profile.get('favourites', [])
    if new_weight >= 5 and song_path not in favourites:
        favourites.append(song_path)
    profile['favourites'] = favourites
    
    profile['skip_count'] = 0
    player.skip_count = 0

    with open(profile_path, 'w', encoding='utf-8') as f:
        f.write(json.dumps(profile, indent=2))
