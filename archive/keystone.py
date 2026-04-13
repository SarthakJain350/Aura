import threading
import queue
import pygame
import json
import os
import time

from modules import onboarding
from modules import voice_input
from modules import mood_detector
from modules import player
from modules import feedback
from ui import aura_ui

def player_worker(player_queue, ui_app):
    while True:
        task = player_queue.get()
        if task is None:
            break
            
        action = task.get('action')
        data = task.get('data')
        
        if action == 'load_and_play':
            mood = data
            player.load_queue(mood)
            song = player.get_current_song()
            if song:
                player.play_song(song)
                ui_app.after(0, lambda: ui_app.update_now_playing(song, mood))
        elif action == 'next':
            player.next_song()
        elif action == 'stop':
            player.stop()
        elif action == 'pause':
            pygame.mixer.music.pause()
        elif action == 'resume':
            pygame.mixer.music.unpause()
            
        player_queue.task_done()

def voice_thread(ui_app, player_queue):
    ui_app.after(0, lambda: ui_app.speak_voice("AURA is online. How are you feeling today?"))
    while True:
        # listen_for_wake_word is blocking
        if voice_input.listen_for_wake_word():
            ui_app.after(0, lambda: ui_app.set_mic_active(True))
            
            cmd = voice_input.listen_for_command()
            
            ui_app.after(0, lambda: ui_app.set_mic_active(False))
            
            if not cmd:
                ui_app.after(0, lambda: ui_app.speak_voice("I did not catch that. Try again."))
                continue
                
            ui_app.after(0, lambda: ui_app.log_command(cmd))

            if "next" in cmd or "skip" in cmd:
                song = player.get_current_song()
                feedback.on_skip(song, None)
                player_queue.put({'action': 'next'})
            elif "stop" in cmd:
                player_queue.put({'action': 'stop'})
            elif "i like this" in cmd or "like this" in cmd:
                song = player.get_current_song()
                feedback.on_full_listen(song, None)
            elif "pause" in cmd:
                player_queue.put({'action': 'pause'})
            elif "resume" in cmd:
                player_queue.put({'action': 'resume'})
            else:
                mood = mood_detector.detect_mood(cmd)
                ui_app.after(0, lambda: ui_app.set_mood(mood))
                
                if mood == 'happy':
                    ui_app.after(0, lambda: ui_app.speak_voice("Love the energy. Let us keep it going."))
                elif mood == 'sad':
                    ui_app.after(0, lambda: ui_app.speak_voice("I hear you. Let me play something comforting."))
                elif mood == 'calm':
                    ui_app.after(0, lambda: ui_app.speak_voice("Going calm. Breathe easy."))
                elif mood == 'focused':
                    ui_app.after(0, lambda: ui_app.speak_voice("Focus mode on. Let us get it done."))
                elif mood == 'energetic':
                    ui_app.after(0, lambda: ui_app.speak_voice("Energy mode activated. Let us go."))
                elif mood == 'stressed':
                    ui_app.after(0, lambda: ui_app.speak_voice("I have got you. Here is something to ease the pressure."))
                
                player_queue.put({'action': 'load_and_play', 'data': mood})

def main():
    pygame.mixer.init()
    
    base_dir = os.path.dirname(os.path.abspath(__file__))
    profile_path = os.path.join(base_dir, 'user_profile.json')
    try:
        with open(profile_path, 'r', encoding='utf-8') as f:
            profile = json.load(f)
    except Exception:
        profile = {}
        
    if not profile.get('onboarded', False):
        onboarding.run_onboarding()

    player_queue = queue.Queue()
    
    # UI must run on main thread
    app = aura_ui.AuraUI(player_queue)
    
    p_thread = threading.Thread(target=player_worker, args=(player_queue, app), daemon=True)
    p_thread.start()
    
    v_thread = threading.Thread(target=voice_thread, args=(app, player_queue), daemon=True)
    v_thread.start()
    
    app.protocol("WM_DELETE_WINDOW", lambda: shutdown(app))
    app.mainloop()

def shutdown(app):
    app.speak_voice("See you next time. Stay well.")
    app.destroy()

if __name__ == '__main__':
    main()
