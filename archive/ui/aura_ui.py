import customtkinter as ctk
import tkinter as tk
import time
import math
import random
import threading
from modules.voice_input import speak

class AuraUI(ctk.CTk):
    def __init__(self, player_queue):
        super().__init__()
        self.player_queue = player_queue
        
        ctk.set_appearance_mode('dark')
        ctk.set_default_color_theme('blue')
        
        self.title('AURA — Adaptive Music Intelligence')
        self.geometry('900x650')
        self.configure(fg_color='#030712')
        self.resizable(False, False)
        
        self.mic_active = False
        self.aura_speaking = False
        
        self._build_ui()
        self._start_animations()
        
    def _build_ui(self):
        # 1. Top status bar
        self.status_bar = ctk.CTkFrame(self, fg_color="transparent")
        self.status_bar.pack(fill='x', padx=20, pady=10)
        
        self.lbl_online = ctk.CTkLabel(self.status_bar, text="AURA ONLINE", text_color="#06b6d4", font=("Courier", 12))
        self.lbl_online.pack(side='left', padx=10)
        
        self.lbl_engine = ctk.CTkLabel(self.status_bar, text="MOOD ENGINE ACTIVE", text_color="#06b6d4", font=("Courier", 12))
        self.lbl_engine.pack(side='left', padx=10)
        
        self.lbl_time = ctk.CTkLabel(self.status_bar, text="", text_color="#06b6d4", font=("Courier", 12))
        self.lbl_time.pack(side='right', padx=10)
        
        self._update_time()
        
        # 2. Animated orb
        self.orb_canvas = tk.Canvas(self, width=220, height=220, bg='#030712', highlightthickness=0)
        self.orb_canvas.pack(pady=10)
        
        # 4. Status text
        self.lbl_status = ctk.CTkLabel(self, text="Say 'Aura' to begin", text_color="#06b6d4", font=("Courier", 14))
        self.lbl_status.pack(pady=5)
        
        # 3. Voice bars
        self.bars_canvas = tk.Canvas(self, width=100, height=50, bg='#030712', highlightthickness=0)
        self.bars_canvas.pack(pady=5)
        self.bars = []
        for i in range(14):
            x = 5 + i * 7
            bar = self.bars_canvas.create_rectangle(x, 21, x+4, 29, fill='#06b6d4', outline='')
            self.bars.append((bar, x))
            
        # 5. Mood pills
        self.mood_frame = ctk.CTkFrame(self, fg_color="transparent")
        self.mood_frame.pack(pady=15)
        
        moods = [
            ("HAPPY", "#fbbf24", 'happy'), 
            ("SAD", "#818cf8", 'sad'), 
            ("CALM", "#34d399", 'calm'), 
            ("FOCUS", "#06b6d4", 'focused'), 
            ("ENERGY", "#f472b6", 'energetic')
        ]
        self.pill_buttons = {}
        for (m_txt, m_col, m_val) in moods:
            btn = ctk.CTkButton(self.mood_frame, text=m_txt, fg_color="#1f2937", border_color=m_col, 
                                border_width=2, text_color=m_col, width=80, 
                                command=lambda v=m_val: self._on_mood_pill(v))
            btn.pack(side='left', padx=5)
            self.pill_buttons[m_val] = btn
            
        # 6. Now playing card
        self.card_frame = ctk.CTkFrame(self, fg_color="#111827", border_color="#06b6d4", border_width=1, width=400, height=80)
        self.card_frame.pack(pady=10)
        self.card_frame.pack_propagate(False)
        
        self.lbl_song = ctk.CTkLabel(self.card_frame, text="No song playing", text_color="white", font=("Arial", 14, "bold"))
        self.lbl_song.pack(pady=(5, 0))
        
        self.lbl_mood_tag = ctk.CTkLabel(self.card_frame, text="MOOD: NONE", text_color="#06b6d4", font=("Courier", 10))
        self.lbl_mood_tag.pack()
        
        self.progress = ctk.CTkProgressBar(self.card_frame, width=300, fg_color="#374151", progress_color="#06b6d4")
        self.progress.pack(pady=5)
        self.progress.set(0)
        
        # 7. Controls row
        self.controls_frame = ctk.CTkFrame(self, fg_color="transparent")
        self.controls_frame.pack(pady=5)
        
        btn_prev = ctk.CTkButton(self.controls_frame, text="|<", width=40, fg_color="#1f2937", text_color="#06b6d4")
        btn_prev.pack(side='left', padx=5)
        
        self.is_playing = True
        self.btn_play = ctk.CTkButton(self.controls_frame, text="||", width=40, fg_color="#06b6d4", text_color="white", command=self._toggle_playback)
        self.btn_play.pack(side='left', padx=5)
        
        btn_next = ctk.CTkButton(self.controls_frame, text=">|", width=40, fg_color="#1f2937", text_color="#06b6d4", command=lambda: self.player_queue.put({'action': 'next'}))
        btn_next.pack(side='left', padx=5)
        
        # 8. Command log
        self.log_frame = ctk.CTkScrollableFrame(self, fg_color="transparent", width=400, height=80)
        self.log_frame.pack(pady=5)
        self.logs = []
        
        # 9. Mic button
        self.btn_mic = ctk.CTkButton(self, text="MIC", width=50, height=50, corner_radius=25, fg_color="#1f2937", border_color="#06b6d4", border_width=2)
        self.btn_mic.place(relx=0.9, rely=0.9, anchor='center')

    def _toggle_playback(self):
        if self.is_playing:
            self.player_queue.put({'action': 'pause'})
            self.btn_play.configure(text=">")
            self.is_playing = False
        else:
            self.player_queue.put({'action': 'resume'})
            self.btn_play.configure(text="||")
            self.is_playing = True

    def _on_mood_pill(self, mood):
        self.set_mood(mood)
        self.player_queue.put({'action': 'load_and_play', 'data': mood})
        self.log_command(f"[Manual] Set mood to {mood}")

    def speak_voice(self, text):
        self.aura_speaking = True
        self.lbl_status.configure(text=f"AURA: {text}")
        def t_speak():
            speak(text)
            self.after(0, lambda: setattr(self, 'aura_speaking', False))
            self.after(0, lambda: self.lbl_status.configure(text="System Idle"))
        threading.Thread(target=t_speak, daemon=True).start()

    def set_mic_active(self, state):
        self.mic_active = state
        if state:
            self.lbl_status.configure(text="Listening...")
            self.btn_mic.configure(fg_color="#06b6d4")
        else:
            self.lbl_status.configure(text="Processing...")
            self.btn_mic.configure(fg_color="#1f2937")

    def set_mood(self, mood):
        for val, btn in self.pill_buttons.items():
            if val == mood:
                btn.configure(fg_color=btn.cget("border_color"), text_color="#111827")
            else:
                btn.configure(fg_color="#1f2937", text_color=btn.cget("border_color"))

    def update_now_playing(self, song_path, mood):
        import os
        if song_path:
            name = os.path.basename(song_path)
            self.lbl_song.configure(text=name)
            self.lbl_mood_tag.configure(text=f"MOOD: {mood.upper()}")
            self.is_playing = True
            self.btn_play.configure(text="||")

    def log_command(self, cmd):
        lbl = ctk.CTkLabel(self.log_frame, text=f"> {cmd}", text_color="#06b6d4", font=("Courier", 11))
        lbl.pack(anchor='w')
        self.logs.append(lbl)
        if len(self.logs) > 5:
            self.logs[0].destroy()
            self.logs.pop(0)

    def _update_time(self):
        t = time.strftime('%H:%M:%S')
        self.lbl_time.configure(text=t)
        self.after(1000, self._update_time)

    def _start_animations(self):
        self.angle_outer = 0
        self.angle_mid = 0
        self.angle_inner = 0
        self.pulse_radius = 50
        self.pulse_fade = 255
        self._animate()
        self._animate_bars()

    def _animate(self):
        self.orb_canvas.delete("all")
        
        speed_mult = 3 if self.mic_active else 1
        
        self.angle_outer += (2 * math.pi / 80) * speed_mult
        self.angle_mid -= (2 * math.pi / 50) * speed_mult
        self.angle_inner += (2 * math.pi / 120) * speed_mult
        
        self._draw_ring(100, 100, self.angle_outer, '#06b6d4')
        self._draw_ring(84, 84, self.angle_mid, '#8b5cf6')
        self._draw_ring(68, 68, self.angle_inner, '#22d3ee')
        
        core_color = '#06b6d4' if self.aura_speaking and int(time.time()*5)%2==0 else '#1e40af'
        self.orb_canvas.create_oval(60, 60, 160, 160, fill='#030712', outline=core_color, width=2)
        
        if self.aura_speaking:
            self.pulse_radius += 2
            self.pulse_fade -= 10
            if self.pulse_fade <= 0:
                self.pulse_radius = 50
                self.pulse_fade = 255
            p_r = self.pulse_radius
            if p_r < 110:
                self.orb_canvas.create_oval(110-p_r, 110-p_r, 110+p_r, 110+p_r, outline='#06b6d4')
            
        self.orb_canvas.create_text(110, 110, text="A", fill="#06b6d4", font=("Courier", 32, "bold"))
        self.after(50, self._animate)

    def _draw_ring(self, rx, ry, angle, color):
        cx, cy = 110, 110
        self.orb_canvas.create_arc(cx-rx, cy-ry, cx+rx, cy+ry, start=math.degrees(angle), extent=120, outline=color, width=3, style=tk.ARC)
        self.orb_canvas.create_arc(cx-rx, cy-ry, cx+rx, cy+ry, start=math.degrees(angle)+180, extent=120, outline=color, width=3, style=tk.ARC)

    def _animate_bars(self):
        for i, (bar, x) in enumerate(self.bars):
            if self.mic_active:
                h = random.randint(12, 40)
            else:
                h = 8
            self.bars_canvas.coords(bar, x, 25-h/2, x+4, 25+h/2)
            
        self.after(100, self._animate_bars)
