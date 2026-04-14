// App.jsx
console.log('[APP] App.jsx loaded');

const { useState, useEffect, useRef } = React;

class ErrorBoundary extends React.Component {
  constructor(props) { 
    super(props)
    this.state = { hasError: false, error: null }
  }
  componentDidCatch(error, info) {
    console.error('[ERROR BOUNDARY] AuraUI crashed:', error)
    console.error('[ERROR BOUNDARY] Component stack:', info)
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{color:'cyan', background:'#030712', padding:'40px', fontFamily:'monospace'}}>
          <h2>AURA encountered an error</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={() => window.location.reload()}>Restart AURA</button>
        </div>
      )
    }
    return this.props.children
  }
}

// Emergency fallback toggle
const showEmergencyFallback = false;

const WAKE_WORD_VARIATIONS = [
  'aura', 'aur', 'aur aap', 'ora', 'laura', 
  'aara', 'orra', 'ara', 'au ra', 'auro', 'hura'
]

const GENRE_MAP = {
    'pop': 'pop', 'lo-fi': 'lo-fi', 'lofi': 'lo-fi', 'lo fi': 'lo-fi',
    'rock': 'rock', 'classical': 'classical', 'hip hop': 'hip-hop',
    'hip-hop': 'hip-hop', 'hiphop': 'hip-hop', 'jazz': 'jazz',
    'electronic': 'electronic', 'edm': 'electronic', 'metal': 'metal'
}

const LANGUAGE_MAP = {
    'hindi': 'Hindi', 'english': 'English', 'korean': 'Korean',
    'spanish': 'Spanish', 'french': 'French', 'arabic': 'Arabic',
    'japanese': 'Japanese'
}

function getWakeWordTrigger(transcript) {
  const lower = transcript.toLowerCase().trim()
  
  // Build a candidate list: prefixed variations take priority over bare ones
  // to ensure "hey aura" matches before "aura" alone.
  const prefixes = ['hey ', 'ok ', 'okay ', 'hi ', 'hello '];
  const candidates = [];
  for (const p of prefixes) {
    for (const v of WAKE_WORD_VARIATIONS) {
      candidates.push(p + v);
    }
  }
  for (const v of WAKE_WORD_VARIATIONS) {
    candidates.push(v);
  }
  
  for (const c of candidates) {
    if (lower.startsWith(c)) {
      // Word-boundary check: the character after the match must be a space or end-of-string
      // This prevents 'ara' from matching 'arabic' or 'aura' from matching 'aural'
      const afterMatch = lower[c.length];
      if (afterMatch === undefined || afterMatch === ' ' || afterMatch === ',' || afterMatch === '.') {
        return c;
      }
    }
  }
  return null;
}


const App = () => {
    const [initialized, setInitialized] = useState(false);
    const [showLogin, setShowLogin] = useState(true);
    const [spotifyUser, setSpotifyUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [justAuthed, setJustAuthed] = useState(false);
    const [micActive, setMicActive] = useState(false);
    const [orbSpeaking, setOrbSpeaking] = useState(false);
    const [statusText, setStatusText] = useState("System Offline");
    const [logs, setLogs] = useState([]);
    const [geminiStatus, setGeminiStatus] = useState('checking');
    const [micStatus, setMicStatus] = useState('failed');
    
    // Core predictive states
    const [mood, setMood] = useState("calm");
    const [moodStartTime, setMoodStartTime] = useState(Date.now());
    const [activeGenre, setActiveGenre] = useState("");
    
    const [interimText, setInterimText] = useState("");
    const [listeningMode, setListeningMode] = useState("passive");
    const [lyricsText, setLyricsText] = useState("");
    const [lyricsLoading, setLyricsLoading] = useState(false);
    const [currentPosMs, setCurrentPosMs] = useState(0);

    const [spotifyReady, setSpotifyReady] = useState(false);
    const [trackInfo, setTrackInfo] = useState(null);
    const [spotifyError, setSpotifyError] = useState('');
    
    // Notifications & UI states
    const [toastMsg, setToastMsg] = useState("");
    const [pendingConfirmation, setPendingConfirmation] = useState(null);
    const confirmTimeoutRef = useRef(null);
    
    // Stability trackers & Refs for voice closures
    const [wakeTimeRemaining, setWakeTimeRemaining] = useState(null);
    const timeoutIntervalRef = useRef(null);
    const autoStarted = useRef(false);
    const [crashTimestamps, setCrashTimestamps] = useState([]);

    const listeningModeRef = useRef('passive');
    const moodRef = useRef("calm");
    const genreRef = useRef("");
    const langRef = useRef("English");
    const wakeTimeoutRef = useRef(null);
    // BUG FIX: stable ref for handleSpeechCommand — prevents stale closures
    // when window.handleSpeechResult is set once in an effect.
    const handleSpeechCommandRef = useRef(null);

    useEffect(() => { 
      listeningModeRef.current = listeningMode;
      console.log('[MODE] Changed to:', listeningMode);
    }, [listeningMode]);
    useEffect(() => { moodRef.current = mood }, [mood]);
    useEffect(() => { genreRef.current = activeGenre }, [activeGenre]);
    useEffect(() => { langRef.current = profile?.music_language || 'English' }, [profile?.music_language]);

    const addLog = (text, type = 'normal', confidence = 'NONE') => {
        setLogs(prev => {
            const next = [...prev, { text, type, confidence }];
            return next.length > 8 ? next.slice(1) : next;
        });
    };
    
    const applyMoodLogic = (newMood, forceGenre = null, method = 'manual_or_confirmed', skipSay = false) => {
        const genreToUse = forceGenre || activeGenre || profile?.preferred_genre || 'mix';
        
        let msg = "";
        const isMoodChange = newMood && newMood !== mood;
        const isGenreChange = forceGenre && forceGenre !== activeGenre;
        
        if (isGenreChange && isMoodChange) {
            msg = `Switching genre to ${genreToUse} and changing vibe to ${newMood}.`;
        } else if (isGenreChange) {
            msg = `Switching genre to ${genreToUse}. Keeping your ${mood} vibe.`;
        } else if (isMoodChange) {
            msg = `Changing vibe to ${newMood}.`;
        }

        setActiveGenre(genreToUse);
        setMood(newMood);
        setMoodStartTime(Date.now());
        window.ProfileService.recordMood(newMood, method);
        addLog(`System updating mood to: ${(newMood || 'mix').toUpperCase()}`, "system", "HIGH");
        if (profile) window.SpotifyService.playMood(newMood, genreToUse, profile.music_language);
        if (!skipSay && msg !== "") say(msg, () => setListeningMode('passive'));
    };

    const handleConfirmResponse = (accepted) => {
        if (!pendingConfirmation) return;
        const { targetMood, isBoot, isDrift } = pendingConfirmation;
        setPendingConfirmation(null);
        clearTimeout(confirmTimeoutRef.current);
        
        if (accepted) {
            if (isDrift) addLog("Spontaneous Shift Confirmed", "drift", "HIGH");
            applyMoodLogic(targetMood, null, isDrift ? 'spontaneous_shift' : 'startup_prediction');
        } else {
            if (isBoot) {
                say("Okay, how are you feeling right now?");
            }
            if (isDrift) {
                addLog("Drift Rejected - maintaining mood", "system", "MEDIUM");
            }
            setListeningMode('passive');
        }
    };

    const say = (text, onEnd) => {
        setOrbSpeaking(true);
        setStatusText(`AURA: ${text}`);
        window.SpeechService.speak(text, () => {
            setOrbSpeaking(false);
            setStatusText(micActive ? "Listening..." : "Idle");
            if (onEnd) onEnd();
        });
    };

    useEffect(() => {
      console.log('[APP] Setting up global speech handlers')
      
      window.setMicActive = (active) => {
        setMicActive(active)
      }

      window.setMicStatus = (status) => {
        console.log('[APP] setMicStatus called:', status)
        setMicStatus(status)
      }
      
      window.setStatusText = setStatusText
      
      // BUG FIX: window.handleSpeechResult is set ONCE and always delegates
      // to the ref, which is updated every render. This prevents stale closures
      // where the old function (with stale listeningMode) would be called.
      window.handleSpeechResult = (transcript, confidence) => {
        console.log('[SPEECH→APP] Sending to handleSpeechResult:', transcript, '| confidence:', confidence)
        if (handleSpeechCommandRef.current) {
          handleSpeechCommandRef.current(transcript, confidence)
        }
      }
      
      // Force start speech after 1 second
      setTimeout(() => {
        console.log('[APP] Force starting speech from App.jsx')
        if (window.SpeechService) {
          window.SpeechService.start()
        } else {
          console.error('[APP] SpeechService not found on window object')
        }
      }, 1000)
      
    }, [])

    // Bug 1: Robust Timers
    useEffect(() => {
        if (listeningMode === 'active' || listeningMode === 'active_manual') {
            setWakeTimeRemaining(listeningMode === 'active_manual' ? 10 : 5);
            timeoutIntervalRef.current = setInterval(() => {
                setWakeTimeRemaining(prev => {
                    if (prev <= 1) {
                        clearInterval(timeoutIntervalRef.current);
                        handleWakeTimeout();
                        return 0; // Triggers UI flash safely
                    }
                    return prev - 1;
                });
            }, 1000);
        } else {
            clearInterval(timeoutIntervalRef.current);
            setWakeTimeRemaining(null);
        }
        return () => clearInterval(timeoutIntervalRef.current);
    }, [listeningMode]);

    const handleWakeTimeout = () => {
        say("I did not catch that. Say Aura to try again.", () => {
            setListeningMode('passive');
            window.SpeechService.start(); 
        });
    };

    // Bug 2: Smooth 300ms Synchronized Granularity
    // Sync music state to window for SpeechService
    useEffect(() => {
        const isPlaying = !!(trackInfo && !trackInfo.paused);
        window.isMusicPlaying = isPlaying;
        
        // Fix 3: Headphones Tip (Once per session, 5s auto-hide)
        if (isPlaying && !localStorage.getItem('aura_headphone_tip_shown')) {
            addLog("🎧 Tip: Use headphones for best results.", "system", "MEDIUM");
            setToastMsg("🎧 Tip: Use headphones for best results while music plays.");
            localStorage.setItem('aura_headphone_tip_shown', 'true');
            setTimeout(() => {
                setToastMsg("");
            }, 5000);
        }
    }, [trackInfo?.paused, trackInfo?.name]);

    useEffect(() => {
        if (!trackInfo || trackInfo.paused) return;
        const iv = setInterval(async () => {
            const pos = await window.SpotifyService.getPosition();
            setCurrentPosMs(pos);
        }, 300);
        return () => clearInterval(iv);
    }, [trackInfo?.paused]);

    useEffect(() => {
        if (!trackInfo) return;
        setCurrentPosMs(0); 
        
        const fetchLyrics = async () => {
            setLyricsLoading(true); setLyricsText("Loading lyrics...");
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 8000); 
                const cleanArtist = trackInfo.artist.split(',')[0].trim();
                const cleanTitle = trackInfo.name.split('(')[0].trim();
                const res = await fetch(`https://lrclib.net/api/get?artist_name=${encodeURIComponent(cleanArtist)}&track_name=${encodeURIComponent(cleanTitle)}`, { signal: controller.signal });
                clearTimeout(timeoutId);
                if (!res.ok) throw new Error("Not found");
                const data = await res.json();
                setLyricsText(data && data.syncedLyrics ? data.syncedLyrics : (data && data.plainLyrics ? data.plainLyrics : "Lyrics not available for this track"));
            } catch (err) { setLyricsText("Lyrics not available for this track"); } 
            finally { setLyricsLoading(false); }
        };
        fetchLyrics();
    }, [trackInfo?.name]);

    useEffect(() => {
        window.updateGeminiStatus = (status) => setGeminiStatus(status);
        // Step 4: Check Chrome Microphone Settings
        navigator.mediaDevices.getUserMedia({audio: true})
            .then(stream => {
                console.log('[MIC] Access granted');
                if (stream.getAudioTracks().length > 0) {
                    console.log('[MIC] Audio tracks:', stream.getAudioTracks());
                    console.log('[MIC] Track settings:', stream.getAudioTracks()[0].getSettings());
                }
            })
            .catch(err => console.error('[MIC] Error:', err.name, err.message));

        if (window.AURA_CONFIG && window.AURA_CONFIG.SPOTIFY_CLIENT_ID === "paste_your_id_here") {
            setSpotifyError("CRITICAL EXCEPTION: src/config.js is empty! Paste SPOTIFY_CLIENT_ID to use AURA.");
        }
        const boot = async () => {
            if (window.location.search.includes('code=')) {
                const {success, error} = await window.SpotifyService.handleCallback();
                console.log('[TOKEN] Token value after auth:', localStorage.getItem('spotify_access_token'));
                console.log('[ONBOARD] onboarded flag:', localStorage.getItem('aura_onboarded'));
                
                if (success) {
                    addLog("Spotify Authenticated.", 'system', 'HIGH');
                    const me = await window.SpotifyService.getMe();
                    if (me) {
                        setSpotifyUser(me); window.ProfileService.setActiveId(me.id);
                        const p = window.ProfileService.getProfile(); setProfile(p);
                        if (p.onboarded) setInitialized(true); else setJustAuthed(true);
                    }
                } else setSpotifyError(error || "Spotify Auth Failed.");
            } else if (localStorage.getItem('spotify_access_token')) {
                const me = await window.SpotifyService.getMe();
                if (me) setSpotifyUser(me);
            }
        }; boot();
    }, []);

    useEffect(() => {
        if (initialized && profile) {
            console.log('[APP] Switching to main UI');
            console.log('[APP] All state values:', { onboarded: profile.onboarded, spotifyToken: localStorage.getItem('spotify_access_token'), profile });
            initPlayer(); startAura();
            setActiveGenre(profile.preferred_genre);
            // Disable buggy auto-mood bot logic
        }
    }, [initialized]);

    useEffect(() => {
        if (!micActive) return;
        const iv = setInterval(() => { setMicActive(true); }, 100);
        return () => clearInterval(iv);
    }, [micActive]);

    const initPlayer = () => {
        window.SpotifyService.initPlayer(() => {
            setSpotifyReady(true); setSpotifyError('');
        }, state => {
            if (state) setTrackInfo({
                name: state.track_window.current_track.name,
                artist: state.track_window.current_track.artists.map(a => a.name).join(", "),
                paused: state.paused, duration_ms: state.track_window.current_track.duration_ms
            });
        });
    };

    // Bug 2: Music Does Not Auto-Start When AURA Loads
    useEffect(() => {
        if (spotifyReady && profile && !autoStarted.current) {
            autoStarted.current = true;
            const startMood = (profile.mood_history && profile.mood_history.length > 0) ? profile.mood_history[profile.mood_history.length - 1].mood : (profile.default_mood || 'calm');
            
            console.log('[AUTOSTART] Starting music with mood:', startMood);
            setStatusText("Loading your playlist...");
            setMood(startMood);
            
            window.SpotifyService.playMood(startMood, activeGenre, profile.music_language);
            say(`Welcome back ${profile.name}. Starting your ${startMood} playlist.`);
            
            setTimeout(() => {
                if (window.SpotifyService && window.SpotifyService.trackInfo?.paused) {
                    setStatusText("Click play to start music");
                }
            }, 5000);
        }
    }, [spotifyReady, profile]);

    const processCommand = (text) => {
        const lower = text.toLowerCase().trim()
        console.log('[COMMAND] Processing:', lower)
        
        // Genre voice commands
        for (const [keyword, genre] of Object.entries(GENRE_MAP)) {
            if (lower.includes(keyword)) {
                console.log('[ACTION] Executing: play_genre', genre)
                setActiveGenre(genre)
                window.SpotifyService.playMood(moodRef.current, genre, langRef.current)
                say(`Switching to ${genre}.`)
                addLog(`Voice genre change: ${genre}`, 'command')
                return
            }
        }
        
        // Language voice commands
        for (const [keyword, language] of Object.entries(LANGUAGE_MAP)) {
            if (lower.includes(keyword)) {
                console.log('[ACTION] Executing: play_language', language)
                const p = {...profile, music_language: language};
                setProfile(p); window.ProfileService.saveProfile(p);
                window.SpotifyService.playMood(moodRef.current, genreRef.current, language);
                say(`Switching to ${language} songs.`)
                addLog(`Voice language change: ${language}`, 'command')
                return
            }
        }
        
        // Playback commands
        if (lower.includes('next') || lower.includes('skip')) {
            console.log('[ACTION] Executing: next', 'track')
            window.SpotifyService.nextSong()
            say('Skipping track.')
            return
        }
        if (lower.includes('pause') || lower.includes('stop')) {
            console.log('[ACTION] Executing: pause', 'playback')
            window.SpotifyService.pause()
            say('Pausing music.')
            return
        }
        if (lower.includes('resume') || lower.includes('play')) {
            console.log('[ACTION] Executing: resume', 'playback')
            window.SpotifyService.resume()
            say('Resuming music.')
            return
        }
        
        // Mood detection
        const moodResult = window.MoodDetector ? window.MoodDetector.detect(text) : null
        if (moodResult && (moodResult.confidence === 'HIGH' || moodResult.confidence === 'MEDIUM')) {
            console.log('[ACTION] Executing: play_mood', moodResult.mood)
            setMood(moodResult.mood)
            window.SpotifyService.playMood(moodResult.mood, genreRef.current, langRef.current)
            say(`Playing ${moodResult.mood} music for you.`)
            return
        }
        
        // Send to Gemini as last resort for complex commands
        if (window.AIEngine) {
            window.AIEngine.processCommand(text).then(result => {
                if (result.reply) say(result.reply)
                if (result.action && result.action.type !== 'none') {
                    const type = result.action.type;
                    const val = result.action.mood || result.action.genre || result.action.language;
                    console.log('[ACTION] Executing:', type, val)
                    
                    switch(type) {
                        case 'play_mood': 
                            setMood(val); 
                            window.SpotifyService.playMood(val, genreRef.current, langRef.current); 
                            break;
                        case 'play_genre': 
                            setActiveGenre(val); 
                            window.SpotifyService.playMood(moodRef.current, val, langRef.current); 
                            break;
                        case 'play_language': 
                            const l = val.charAt(0).toUpperCase() + val.slice(1);
                            const p = {...profile, music_language: l}; setProfile(p); window.ProfileService.saveProfile(p);
                            window.SpotifyService.playMood(moodRef.current, genreRef.current, l); 
                            break;
                        case 'next': window.SpotifyService.nextSong(); break;
                        case 'pause': window.SpotifyService.pause(); break;
                        case 'resume': window.SpotifyService.resume(); break;
                    }
                }
            })
        }
    }

    const handleSpeechCommand = (transcript, confidence) => {
        setInterimText(""); 
        const lower = transcript.toLowerCase().trim();
        console.log('[APP←SPEECH] Received transcript:', lower, '| mode:', listeningModeRef.current);
        
        const currentMode = listeningModeRef.current;
        const wakeTrigger = getWakeWordTrigger(lower);
        console.log('[WAKE CHECK] wakeTrigger:', wakeTrigger, '| transcript:', lower);
        
        // Scenario 1: Wake word detected (potentially with a command)
        if (wakeTrigger) {
            console.log('[WAKE] Trigger detected:', wakeTrigger);
            const remainingCommand = lower.replace(wakeTrigger, '').trim();
            
            if (remainingCommand.length > 1) {
                console.log('[WAKE] One-shot command detected:', remainingCommand);
                setListeningMode('active');
                addLog(`One-shot trigger: ${remainingCommand}`, 'command', 'HIGH');
                processCommand(remainingCommand);
            } else {
                console.log('[WAKE] Simple wake detected');
                setListeningMode('active');
                say('Yes?');
                
                if (wakeTimeoutRef.current) clearTimeout(wakeTimeoutRef.current);
                wakeTimeoutRef.current = setTimeout(() => {
                    if (listeningModeRef.current === 'active') {
                        console.log('[WAKE] Timeout — returning to passive');
                        setListeningMode('passive');
                        say('I did not catch that. Say Aura to try again.');
                    }
                }, 10000);
            }
            return;
        }
        
        // Scenario 2: Already in active mode, process the command
        if (currentMode === 'active' || currentMode === 'active_manual') {
            console.log('[ACTIVE] Processing command:', lower);
            if (wakeTimeoutRef.current) clearTimeout(wakeTimeoutRef.current);
            setListeningMode('passive');
            processCommand(lower);
            return;
        }
        
        // Scenario 3: Passive mode - check for high-confidence direct triggers (vibe/genre)
        if (currentMode === 'passive') {
            // Check for direct genre switch keywords
            for (const [keyword, genre] of Object.entries(GENRE_MAP)) {
                if (lower.includes(keyword) && (lower.includes('play') || lower.includes('switch') || lower.includes('change'))) {
                    console.log('[PASSIVE] Direct genre detected:', genre);
                    setActiveGenre(genre);
                    window.SpotifyService.playMood(moodRef.current, genre, langRef.current);
                    say(`Switching to ${genre}.`);
                    addLog(`Passive genre change: ${genre}`, 'command');
                    return;
                }
            }

            // Check for direct mood detection
            const moodResult = window.MoodDetector ? window.MoodDetector.detect(lower) : null;
            if (moodResult && moodResult.confidence === 'HIGH') {
                console.log('[PASSIVE] Direct mood detected:', moodResult.mood);
                setMood(moodResult.mood);
                window.SpotifyService.playMood(moodResult.mood, genreRef.current, langRef.current);
                say(`Playing ${moodResult.mood} music for you.`);
                addLog(`Passive mood shift: ${moodResult.mood}`, 'command');
            }
        }
    };
function setActiveMood(mood) { setMood(mood); }

    // BUG FIX: Update the ref every render so window.handleSpeechResult always
    // calls the latest version of handleSpeechCommand with fresh state.
    // This is the correct pattern — NO stale closure, NO window re-assignment per render.
    useEffect(() => {
        handleSpeechCommandRef.current = handleSpeechCommand;
    });

    const handleSkip = () => {
        const skips = window.ProfileService.onSkip('current_track_proxy');
        if (skips >= 3) {
            const gr = window.ProfileService.getGenreRotation();
            const nextGenreIdx = (gr.indexOf(activeGenre) + 1) % gr.length;
            const newGenre = gr[nextGenreIdx < 0 ? 0 : nextGenreIdx];
            
            window.ProfileService.resetSkipCount(); 
            setActiveGenre(newGenre);
            setToastMsg(`Switching genre to ${newGenre}`);
            setTimeout(() => setToastMsg(''), 3000);
            
            addLog(`Fallback triggered: switching to ${newGenre}`, "system", "HIGH");
            say("You have skipped 3 songs. Let me try something different.");
            
            window.SpotifyService.playMood(mood, newGenre);
        } else {
            window.SpotifyService.nextSong();
            say("Got it, skipping.");
        }
    };

    const handleSpeechError = (err) => {
        setCrashTimestamps(prev => {
            const now = Date.now();
            const recent = prev.filter(t => now - t < 30000);
            const next = [...recent, now];
            if (next.length >= 3) {
                 return [];
            }
            return next;
        });
    };

    const startAura = () => {
        window.SpeechService.init(
            handleSpeechCommand, 
            (isList) => {
                setMicActive(isList);
                if (!orbSpeaking) setStatusText(isList ? "Listening..." : "Idle");
            },
            (interim) => setInterimText(interim),
            handleSpeechError
        );
        window.SpeechService.start();
        say("AURA is online. Say Aura to awaken me.", () => setListeningMode('passive'));
    };

    if (showEmergencyFallback) {
        return (
            <div style={{background:'#030712', color:'cyan', fontFamily:'monospace', padding:'40px'}}>
                <h1>AURA Online</h1>
                <p>Mood: {mood}</p>
                <button onClick={() => window.SpotifyService && window.SpotifyService.togglePlay()}>Play/Pause</button>
                <button onClick={() => window.SpotifyService && window.SpotifyService.nextSong()}>Next</button>
            </div>
        )
    }

    return (
        <div style={{ position: 'relative', width: '100vw', height: '100vh', backgroundColor: '#050510', overflow: 'hidden' }}>
            {/* Live background removed for raw interactive aesthetic, or kept subtle */}
            <video 
                src="./background/my_wallpaper.mp4" 
                autoPlay loop muted playsInline
                style={{
                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 
                    objectFit: 'cover', zIndex: 0
                }}
            />

            <div style={{ position: 'absolute', inset: 0, opacity: (!showLogin && profile?.onboarded) ? 1 : 0, transition: 'opacity 1.5s ease-in-out', zIndex: 1 }}>
                {initialized && profile && profile.onboarded && (
                    <ErrorBoundary>
                    <window.AuraUI 
                        micActive={micActive} orbSpeaking={orbSpeaking} statusText={statusText} logs={logs}
                        mood={mood} setMood={(m) => {
                            window.SpeechService.stop(); setInterimText(""); addLog(`Manual Overide: ${m}`, 'direct', 'HIGH');
                            applyMoodLogic(m, null, 'manual'); setListeningMode('passive');
                        }} 
                        listeningMode={listeningMode} interimText={interimText}
                        isPlaying={trackInfo !== null && !trackInfo.paused} language={profile?.music_language}
                        activeGenre={activeGenre} toastMsg={toastMsg} pendingConfirmation={pendingConfirmation} onConfirmMood={handleConfirmResponse}
                        onChangeLanguage={(lang) => { 
                            if (lang === profile?.music_language) return;
                            const p = {...profile, music_language: lang}; 
                            setProfile(p); window.ProfileService.saveProfile(p);
                            say(`Switching to ${lang} songs. Keeping your ${mood} vibe.`, () => setListeningMode('passive'));
                            window.SpotifyService.playMood(mood, activeGenre, lang); 
                        }}
                        onChangeGenre={(g) => applyMoodLogic(mood, g, 'manual_genre')}
                        onLogout={() => { window.SpotifyService.logout(); window.ProfileService.clearAll(); window.location.reload(); }}
                        lyricsText={lyricsText} lyricsLoading={lyricsLoading}
                        currentPosMs={currentPosMs} trackDuration={trackInfo?.duration_ms || 1000} wakeTimeRemaining={wakeTimeRemaining}
                        trackInfo={trackInfo} profile={profile} geminiStatus={geminiStatus}
                        micStatus={micStatus}
                        onOrbClick={() => {
                            setListeningMode('active_manual');
                            window.SpeechService.start();
                        }}
                    >
                        {/* Redundant playback controls removed in favor of pinned AuraUI controls */}
                    </window.AuraUI>
                    </ErrorBoundary>
                )}
            </div>
            
            <div style={{ position: 'absolute', inset: 0, opacity: showLogin ? 1 : 0, transition: 'opacity 1.5s ease-in-out', zIndex: 100, pointerEvents: showLogin ? 'auto' : 'none' }}>
                <window.Onboarding 
                    onComplete={(p) => { 
                        setProfile(p); 
                        setShowLogin(false);
                        const tm = setTimeout(() => {
                            setInitialized(true); 
                            setJustAuthed(true); 
                        }, 100);
                    }} 
                    onReturningComplete={(p) => {
                        setProfile(p);
                        setShowLogin(false);
                        const tm = setTimeout(() => {
                            setInitialized(true); 
                        }, 100);
                    }}
                    spotifyUser={spotifyUser} 
                    justAuthed={justAuthed}
                    profile={profile}
                    onSpotifyLogin={() => window.SpotifyService.login()}
                    onSpotifyLogout={() => { window.SpotifyService.logout(); window.ProfileService.clearAll(); window.location.reload(); }}
                />
            </div>
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
