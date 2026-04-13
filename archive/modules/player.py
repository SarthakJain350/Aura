import os
import json
import random
import pygame

# Helper to avoid circular/redundant imports where possible
from modules.voice_input import speak

current_queue = []
current_index = 0
skip_count = 0

def load_queue(mood):
    global current_queue, current_index
    
    base_dir = os.path.dirname(os.path.abspath(__file__))
    map_path = os.path.join(base_dir, '..', 'mood_map.json')
    try:
        with open(map_path, 'r', encoding='utf-8') as f:
            mood_map = json.load(f)
    except Exception:
        mood_map = {}
        
    folder_rel = mood_map.get(mood, f"music/{mood}")
    folder_abs = os.path.join(base_dir, '..', folder_rel)
    
    if not os.path.exists(folder_abs):
        speak('No songs found for this mood. Please add music files.')
        current_queue = []
        return
        
    all_files = [f for f in os.listdir(folder_abs) if f.casefold().endswith('.mp3')]
    if not all_files:
        speak('No songs found for this mood. Please add music files.')
        current_queue = []
        return
        
    random.shuffle(all_files)
    current_queue = [os.path.join(folder_abs, f) for f in all_files[:7]]
    current_index = 0

def play_song(filepath):
    if not pygame.mixer.get_init():
        pygame.mixer.init()
    try:
        pygame.mixer.music.load(filepath)
        pygame.mixer.music.play()
        print(f"[Player] Playing: {filepath}")
    except Exception as e:
        print(f"[Player Error] Could not play {filepath}: {e}")

def next_song():
    global current_index, skip_count, current_queue
    current_index += 1
    
    if skip_count >= 3:
        # Load favourites trigger
        base_dir = os.path.dirname(os.path.abspath(__file__))
        profile_path = os.path.join(base_dir, '..', 'user_profile.json')
        try:
            with open(profile_path, 'r', encoding='utf-8') as f:
                profile = json.load(f)
            favourites = profile.get('favourites', [])
        except Exception:
            favourites = []
            
        if favourites:
            speak("Switching to your favourites.")
            current_queue = favourites
            current_index = 0
            skip_count = 0
            
            if current_queue:
                play_song(current_queue[current_index])
            return
        else:
            skip_count = 0
            speak("You have no favourites yet.")
            
    if current_index >= len(current_queue):
        speak("End of queue.")
        return
        
    play_song(current_queue[current_index])

def stop():
    if pygame.mixer.get_init():
        pygame.mixer.music.stop()

def get_current_song():
    if 0 <= current_index < len(current_queue):
        return current_queue[current_index]
    return None
