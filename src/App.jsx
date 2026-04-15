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
  'aara', 'orra', 'ara', 'au ra', 'auro', 'hura',
  'or a', 'our a', 'are a', 'ar a', 'o r a'
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

// Fuzzy intent normalizer — maps common Chrome mishearings to canonical command words
// This lets AURA understand intent even when it hears "paws" instead of "pause"
const FUZZY_INTENT_MAP = {
    // Pause variants
    'paws': 'pause', 'pos': 'pause', 'boss': 'pause', 'cause': 'pause',
    'horse': 'pause', 'paused': 'pause', 'pawse': 'pause', 'polls': 'pause',
    // Skip/Next variants
    'skit': 'skip', 'ship': 'skip', 'strip': 'skip', 'chip': 'skip',
    'text': 'next', 'necks': 'next', 'sex': 'next', 'net': 'next', 'nex': 'next',
    // Play/Resume variants
    'blade': 'play', 'clay': 'play', 'lay': 'play', 'pray': 'play',
    'resume day': 'resume', 'result': 'resume', 'resumed': 'resume',
    // Stop variants
    'shop': 'stop', 'top': 'stop', 'cop': 'stop',
    // Mood variants
    'appy': 'happy', 'hapi': 'happy', 'nappy': 'happy',
    'set': 'sad', 'bad': 'sad', 'mad': 'sad',
    'com': 'calm', 'palm': 'calm', 'balm': 'calm',
    'energized': 'energetic', 'energy': 'energetic', 'energise': 'energetic',
    'tie': 'tired', 'tired of': 'tired',
    // Genre variants
    'rocks': 'rock', 'rot': 'rock',
    'classic': 'classical', 'classics': 'classical',
    'jazz hands': 'jazz',
    // Language variants
    'indie': 'hindi', 'windy': 'hindi', 'indy': 'hindi',
    'english man': 'english', 'anglish': 'english',
    // Mishearings of 'calm'
    'come': 'calm', 'cum': 'calm', 'karma': 'calm', 'com': 'calm', 'column': 'calm', 'car': 'calm',
    'play heart': 'play hard', 'play pop': 'play pop'
}

// Pre-processes a transcript — replaces known mishearings before intent routing
function normalizeSpeech(transcript) {
    let t = transcript.toLowerCase().trim();
    // Full-phrase replacements first (longest match wins)
    for (const [wrong, right] of Object.entries(FUZZY_INTENT_MAP)) {
        if (t === wrong) { t = right; break; }
    }
    // Word-level substitution inside longer phrases
    const words = t.split(' ');
    const fixed = words.map(w => FUZZY_INTENT_MAP[w] || w);
    return fixed.join(' ');
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
    
    // Phase 4 States
    const [isMicMuted, setIsMicMuted] = useState(localStorage.getItem('aura_mic_muted') === 'true');
    const [isDND, setIsDND] = useState(false);
    const [notification, setNotification] = useState(null);
    const shownNotificationsRef = useRef(new Set());
    const genreStartTimeRef = useRef(Date.now());
    const lastVoiceCommandTimeRef = useRef(Date.now());
    const skipCountRef = useRef(0);
    const lastSkipTimeRef = useRef(Date.now());
    
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
    const [pendingNegativeConfirmation, setPendingNegativeConfirmation] = useState(null);
    const [negativeTrackCount, setNegativeTrackCount] = useState(0);
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
    const handleDirectCommandRef = useRef(null);
    const lastMoodChangeRef = useRef(0);
    const commandBufferRef = useRef("");
    const settleTimerRef = useRef(null);

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
        const now = Date.now();
        if (now - lastMoodChangeRef.current < 5000) {
            console.log('[MOOD] Ignored mood change due to 5-second cooldown.');
            return;
        }
        
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
        lastMoodChangeRef.current = Date.now();
        window.ProfileService.recordMood(newMood, method);
        addLog(`System updating mood to: ${(newMood || 'mix').toUpperCase()}`, "system", "HIGH");
        // BUG FIX: Use langRef.current instead of profile.music_language
        // profile.music_language is stale React state when a language change just happened in the same tick
        if (profile) window.SpotifyService.playMood(newMood, genreToUse, langRef.current);
        if (!skipSay && msg !== "") say(msg, () => setListeningMode('passive'));
    };

    const handleConfirmResponse = (accepted) => {
        // This handles the YES/NO button click from the UI popup
        if (wakeTimeoutRef.current) clearTimeout(wakeTimeoutRef.current);
        setListeningMode('passive');
        const stateInfo = pendingNegativeConfirmation || (pendingConfirmation ? {detectedMood: pendingConfirmation.detectedMood, counterPart: pendingConfirmation.counterPart, requestedGenre: pendingConfirmation.requestedGenre} : {detectedMood: 'calm', counterPart: 'happy', requestedGenre: null});
        setPendingNegativeConfirmation(null);
        setPendingConfirmation(null);
        clearTimeout(confirmTimeoutRef.current);
        
        if (accepted) {
            say(`Okay! Let's turn things around with some ${stateInfo.counterPart} music. 🎶`);
            setNegativeTrackCount(0);
            applyMoodLogic(stateInfo.counterPart, stateInfo.requestedGenre);
        } else {
            say(`I understand. I'll be right here with you. Let me know if you want to change things up.`);
            applyMoodLogic(stateInfo.detectedMood, stateInfo.requestedGenre);
        }
    };

    const say = (text, onEnd) => {
        if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
        commandBufferRef.current = "";

        if (isDND) {
            if (onEnd) onEnd();
            return;
        }
        
        const shouldDuck = window.SpotifyService && window.SpotifyService.player && trackInfo && !trackInfo.paused;
        if (shouldDuck) {
            window.SpotifyService.setVolume(0.1);
        }

        setOrbSpeaking(true);
        setStatusText(`AURA: ${text}`);
        window.SpeechService.speak(text, () => {
            setOrbSpeaking(false);
            if (shouldDuck && window.SpotifyService && window.SpotifyService.player) {
                window.SpotifyService.setVolume(0.5); // restore default
            }
            setStatusText(micActive ? "Listening..." : "Idle");
            if (onEnd) onEnd();
        });
    };

    const POSITIVE_COUNTERPARTS = {
        'sad': 'happy',
        'tired': 'energetic',
        'angry': 'calm',
        'stressed': 'calm'
    };

    const handleDetectedMood = (detectedMood, forceDirect = false, forceGenre = null) => {
        if (POSITIVE_COUNTERPARTS[detectedMood] && !forceDirect) {
            const counterPart = POSITIVE_COUNTERPARTS[detectedMood];
            const confirmData = { detectedMood, counterPart, requestedGenre: forceGenre };
            setPendingNegativeConfirmation(confirmData);
            
            if (!isDND) {
                setPendingConfirmation({
                    msg: `💙 I sense you're feeling ${detectedMood}. Want me to try lifting your mood with some ${counterPart} music instead?`,
                    detectedMood,
                    counterPart,
                    requestedGenre: forceGenre
                });
            }
            setListeningMode('awaiting_negative_response');
            say(`I hear you. I can play something to lift your spirits, or match your current vibe. Say yes for ${counterPart} music, or no for ${detectedMood} music.`);
            
            if (wakeTimeoutRef.current) clearTimeout(wakeTimeoutRef.current);
            wakeTimeoutRef.current = setTimeout(() => {
                if (listeningModeRef.current === 'awaiting_negative_response') {
                    setListeningMode('passive');
                    setPendingNegativeConfirmation(null);
                    setPendingConfirmation(null);
                    say(`I'll play some ${detectedMood} music for now.`);
                    applyMoodLogic(detectedMood, forceGenre);
                }
            }, 15000);
        } else {
            setNegativeTrackCount(0);
            applyMoodLogic(detectedMood, forceGenre);
        }
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

      window.handleDirectCommand = (transcript) => {
        console.log('[TEXT→APP] Sending direct command:', transcript)
        if (handleDirectCommandRef.current) {
          handleDirectCommandRef.current(transcript)
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
            setWakeTimeRemaining(10);
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
        if (!trackInfo || !trackInfo.name) return;
        
        const isNegativeMood = Object.keys(POSITIVE_COUNTERPARTS).includes(moodRef.current);
        if (isNegativeMood) {
            setNegativeTrackCount(prev => {
                const nextCount = prev + 1;
                // Fire empathy check only once — exactly when 2 full songs have played
                if (nextCount === 2) {
                    setTimeout(() => {
                        // Call handleDetectedMood to trigger the actual visual empathy popup
                        handleDetectedMood(moodRef.current);
                    }, 4000);
                    return 99; // Set to 99 so it never triggers again this session 
                }
                return nextCount;
            });
        } else {
            setNegativeTrackCount(0);
        }
    }, [trackInfo?.name]);

    useEffect(() => {
        if (!trackInfo) return;
        setCurrentPosMs(0); 
        
        const fetchLyrics = async () => {
            setLyricsLoading(true); setLyricsText("Loading lyrics...");
            const cleanArtist = trackInfo.artist.split(',')[0].trim();
            const cleanTitle = trackInfo.name.split('(')[0].trim();
            
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 6000); 
                const res = await fetch(`https://lrclib.net/api/get?artist_name=${encodeURIComponent(cleanArtist)}&track_name=${encodeURIComponent(cleanTitle)}`, { signal: controller.signal });
                clearTimeout(timeoutId);
                
                if (!res.ok) throw new Error("lrclib failed");
                const data = await res.json();
                if (data && data.syncedLyrics) {
                    setLyricsText(data.syncedLyrics);
                    setLyricsLoading(false);
                    return;
                } else if (data && data.plainLyrics) {
                    setLyricsText(data.plainLyrics);
                    setLyricsLoading(false);
                    return;
                } else {
                    throw new Error("lrclib empty");
                }
            } catch (err) { 
                console.log('[LYRICS] Primary API failed, trying fallback...');
                try {
                    const controller2 = new AbortController();
                    const timeoutId2 = setTimeout(() => controller2.abort(), 6000);
                    const fallbackRes = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(cleanArtist)}/${encodeURIComponent(cleanTitle)}`, { signal: controller2.signal });
                    clearTimeout(timeoutId2);
                    const fallbackData = await fallbackRes.json();
                    if (fallbackData && fallbackData.lyrics) {
                        setLyricsText(fallbackData.lyrics);
                    } else {
                        setLyricsText("Lyrics not available for this track");
                    }
                } catch(e) {
                    setLyricsText("Lyrics not available for this track"); 
                }
            } 
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
            
            // Phase 3: Background Token Refresher
            const tokenInterval = setInterval(() => {
                if (window.SpotifyService.refreshToken) {
                    window.SpotifyService.refreshToken();
                }
            }, 45 * 60 * 1000);
            return () => clearInterval(tokenInterval);
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

    // Startup: Ask how the user is feeling instead of auto-playing last mood
    useEffect(() => {
        if (spotifyReady && profile && !autoStarted.current) {
            autoStarted.current = true;

            const fallbackMood = (profile.mood_history && profile.mood_history.length > 0)
                ? profile.mood_history[profile.mood_history.length - 1].mood
                : (profile.default_mood || 'calm');

            console.log('[AUTOSTART] Asking mood check-in. Fallback:', fallbackMood);
            setStatusText("How are you feeling?");

            // Greet and ask — set active mode so the next voice/text input goes straight to processCommand
            say(`Hey ${profile.name}! How are you feeling today?`, () => {
                setListeningMode('active');

                // If user says nothing in 10s, fall back to last known mood and start playing
                if (wakeTimeoutRef.current) clearTimeout(wakeTimeoutRef.current);
                wakeTimeoutRef.current = setTimeout(() => {
                    if (listeningModeRef.current === 'active') {
                        setListeningMode('passive');
                        setStatusText("Loading your playlist...");
                        setMood(fallbackMood);
                        window.SpotifyService.playMood(fallbackMood, activeGenre, langRef.current);
                        say(`I'll start your ${fallbackMood} playlist from last time.`);
                    }
                }, 10000);
            });
        }
    }, [spotifyReady, profile]);

    const processCommand = (text) => {
        const raw = text.toLowerCase().trim()
        const lower = normalizeSpeech(raw);
        if (raw !== lower) console.log('[FUZZY] Normalized command:', raw, '->', lower);
        console.log('[COMMAND] Processing:', lower)
        
        // Intercept Voice Toggles (Priority overrides)
        if (lower.includes('mute') || lower.includes('stop listening')) {
            setIsMicMuted(true); localStorage.setItem('aura_mic_muted', 'true');
            say('Microphone muted.'); return;
        }
        if (lower.includes('unmute') || lower.includes('start listening')) {
            setIsMicMuted(false); localStorage.setItem('aura_mic_muted', 'false');
            say('Microphone active.'); return;
        }
        if (lower.includes('do not disturb') || lower.includes('silence') || lower.includes('quiet mode')) {
            setIsDND(true); say('Do not disturb activated.'); return;
        }
        if (lower.includes('dnd off') || lower.includes('disable do not disturb')) {
            setIsDND(false); say('Do not disturb disabled.'); return;
        }
        
        // === MULTI-INTENT: Collect ALL matching intents first, then execute ===
        let detectedMood = null;
        let detectedGenre = null;
        let detectedLanguage = null;
        let detectedPlayback = null;

        // Playback commands
        const words = lower.split(' ');
        if (words.includes('next') || words.includes('skip')) {
            detectedPlayback = 'next';
        } else if (words.includes('pause') || words.includes('stop')) {
            detectedPlayback = 'pause';
        } else if (words.includes('resume') || words.includes('play')) {
            detectedPlayback = 'resume';
        }

        // Genre detection
        for (const [keyword, genre] of Object.entries(GENRE_MAP)) {
            if (lower.includes(keyword)) {
                detectedGenre = genre;
                break;
            }
        }
        
        // Language detection
        for (const [keyword, language] of Object.entries(LANGUAGE_MAP)) {
            if (lower.includes(keyword)) {
                detectedLanguage = language;
                break;
            }
        }
        
        // Mood detection (always run unless it's a pure pause/stop to prevent misinterpreting pause as mood)
        if (detectedPlayback !== 'pause') {
            const moodResult = window.MoodDetector ? window.MoodDetector.detect(text) : null;
            if (moodResult && (moodResult.confidence === 'HIGH' || moodResult.confidence === 'MEDIUM')) {
                detectedMood = moodResult.mood;
            }
        }

        // === EXECUTE ===
        const hasContentChange = detectedMood || detectedGenre || detectedLanguage;

        // If it's a standalone playback command (e.g. "pause", "resume", "skip")
        if (detectedPlayback && !hasContentChange) {
            if (detectedPlayback === 'next') { window.SpotifyService.nextSong(); say('Skipping track.'); }
            else if (detectedPlayback === 'pause') { window.SpotifyService.pause(); say('Pausing music.'); }
            else if (detectedPlayback === 'resume') { window.SpotifyService.resume(); say('Resuming music.'); }
            addLog(`Playback: ${detectedPlayback}`, 'command');
            return;
        }

        // If there are content changes, those apply logic that handles playing them automatically
        
        // Apply language first (updates profile)
        if (detectedLanguage) {
            const p = {...profile, music_language: detectedLanguage};
            setProfile(p); window.ProfileService.saveProfile(p);
            langRef.current = detectedLanguage;
        }

        // Apply genre
        if (detectedGenre) {
            if (detectedGenre !== activeGenre) genreStartTimeRef.current = Date.now();
            setActiveGenre(detectedGenre);
            genreRef.current = detectedGenre;
        }

        // Apply mood (which may intercept for empathy flow)
        if (detectedMood) {
            const finalGenre = detectedGenre || genreRef.current;
            const finalLang = detectedLanguage || langRef.current;
            const isMultiIntent = !!(detectedGenre || detectedLanguage || detectedPlayback);
            console.log('[ACTION] Multi-intent mood:', detectedMood, 'genre:', finalGenre, 'lang:', finalLang);
            // Temporarily update refs so applyMoodLogic uses correct values
            if (detectedGenre) genreRef.current = detectedGenre;
            if (detectedLanguage) langRef.current = detectedLanguage;
            handleDetectedMood(detectedMood, isMultiIntent, detectedGenre);
            addLog(`Multi-intent: mood=${detectedMood} genre=${finalGenre} lang=${finalLang}`, 'command', 'HIGH');
            return;
        }

        // If only genre/language changed (no mood), just update playback
        if (detectedGenre || detectedLanguage) {
            const finalMood = moodRef.current;
            const finalGenre = detectedGenre || genreRef.current;
            const finalLang = detectedLanguage || langRef.current;
            window.SpotifyService.playMood(finalMood, finalGenre, finalLang);
            let msg = [];
            if (detectedGenre) msg.push(`genre to ${detectedGenre}`);
            if (detectedLanguage) msg.push(`language to ${detectedLanguage}`);
            say(`Switching ${msg.join(' and ')} songs.`);
            addLog(`Partial match: ${msg.join(', ')}`, 'command', 'MEDIUM');
            return;
        }
        
        // === FALLBACK: No local match — send to Gemini for complex NL understanding ===
        if (window.AIEngine) {
            window.AIEngine.processCommand(text).then(result => {
                if (result.reply) say(result.reply)
                if (result.action && result.action.type !== 'none') {
                    const type = result.action.type;
                    switch(type) {
                        case 'play_mood': 
                            handleDetectedMood(result.action.mood); 
                            break;
                        case 'play_genre': 
                            setActiveGenre(result.action.genre); 
                            window.SpotifyService.playMood(moodRef.current, result.action.genre, langRef.current); 
                            break;
                        case 'play_language': {
                            const l = result.action.language.charAt(0).toUpperCase() + result.action.language.slice(1);
                            const p = {...profile, music_language: l}; setProfile(p); window.ProfileService.saveProfile(p);
                            window.SpotifyService.playMood(moodRef.current, genreRef.current, l); 
                            break;
                        }
                        case 'next': window.SpotifyService.nextSong(); break;
                        case 'pause': window.SpotifyService.pause(); break;
                        case 'resume': window.SpotifyService.resume(); break;
                    }
                }
            })
        }
    }

    const handleSpeechCommand = (transcript, confidence) => {
        if (isMicMuted) {
            console.log('[APP] Ignored speech input (Mic is muted)');
            return;
        }
        
        lastVoiceCommandTimeRef.current = Date.now();
        
        setInterimText(""); 
        const raw = transcript.toLowerCase().trim();
        const lower = normalizeSpeech(raw);
        console.log('[APP<-SPEECH] Final snippet:', lower, '| mode:', listeningModeRef.current);

        // Clear any existing settle timer and add to buffer
        if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
        commandBufferRef.current = (commandBufferRef.current + " " + lower).trim();

        // If it's a very short command like " Aura", process immediately
        const b = commandBufferRef.current;
        if (b === 'aura' || b === 'aura aura') {
           executeActualHandleSpeech(b, confidence);
           return;
        }

        console.log('[ACTIVE] Settling command buffer:', b);
        settleTimerRef.current = setTimeout(() => {
           console.log('[ACTIVE] Settle complete — executing:', commandBufferRef.current);
           const finalCommand = commandBufferRef.current;
           commandBufferRef.current = "";
           executeActualHandleSpeech(finalCommand, confidence);
        }, 400);
    };

    const executeActualHandleSpeech = (lower, confidence) => {
        console.log('[APP] executeActualHandleSpeech:', lower, '| mode:', listeningModeRef.current);
        
        const currentMode = listeningModeRef.current;
        const wakeTrigger = getWakeWordTrigger(lower);
        console.log('[WAKE CHECK] wakeTrigger:', wakeTrigger, '| transcript:', lower);
        
        // Scenario 0: Awaiting Negative Mood Confirmation (voice response)
        if (currentMode === 'awaiting_negative_response') {
            if (wakeTimeoutRef.current) clearTimeout(wakeTimeoutRef.current);
            setListeningMode('passive');
            const stateInfo = pendingNegativeConfirmation || {detectedMood: 'calm', counterPart: 'happy', requestedGenre: null};
            setPendingNegativeConfirmation(null);
            setPendingConfirmation(null);
            
            if (lower.includes('yes') || lower.includes('change') || lower.includes('positive') || lower.includes('sure') || lower.includes('yeah') || lower.includes('yup')) {
                say(`Okay! Let's turn things around with some ${stateInfo.counterPart} music.`);
                setNegativeTrackCount(0);
                applyMoodLogic(stateInfo.counterPart, stateInfo.requestedGenre);
            } else if (lower.includes('no') || lower.includes('match') || lower.includes('nah') || lower.includes('stay') || lower.includes('nope')) {
                say(`I understand. I'll be right here with you.`);
                applyMoodLogic(stateInfo.detectedMood, stateInfo.requestedGenre);
            } else {
                say(`I'll match your current vibe then.`);
                applyMoodLogic(stateInfo.detectedMood, stateInfo.requestedGenre);
            }
            return;
        }

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
        
        // Scenario 3: Passive mode — check for direct single-word triggers without wake word
        if (currentMode === 'passive') {
            // Priority 2/3: Voice toggles
            if (lower.includes('mute') || lower.includes('stop listening')) {
                setIsMicMuted(true); localStorage.setItem('aura_mic_muted', 'true');
                say('Microphone muted.'); return;
            }
            if (lower.includes('unmute') || lower.includes('start listening')) {
                setIsMicMuted(false); localStorage.setItem('aura_mic_muted', 'false');
                say('Microphone active.'); return;
            }
            if (lower.includes('do not disturb') || lower.includes('silence') || lower.includes('quiet mode')) {
                setIsDND(true); 
                say('Do not disturb activated.'); return;
            }
            if (lower.includes('dnd off') || lower.includes('disable do not disturb')) {
                setIsDND(false); 
                say('Do not disturb disabled.'); return;
            }

            // Direct playback keywords — more robust matching
            const skipWords = ['skip', 'next', 'next song', 'skip track', 'next track'];
            const pauseWords = ['pause', 'stop', 'shut up', 'silence', 'pause music'];
            const resumeWords = ['resume', 'play', 'unpause', 'resume music'];

            if (skipWords.some(k => lower.includes(k))) {
                handleSkip(); return;
            }
            if (pauseWords.some(k => lower.includes(k))) {
                window.SpotifyService.pause(); say('Pausing.'); return;
            }
            if (resumeWords.some(k => lower.includes(k))) {
                window.SpotifyService.resume(); say('Resuming.'); return;
            }

            // If the user utters a complex action command but the wake word was clipped or misheard,
            // forward it explicitly to the active command processor so multi-intents are respected.
            if (lower.startsWith('play ') || lower.includes(' play ') || 
                lower.startsWith('switch ') || lower.includes(' switch ') || 
                lower.startsWith('change ') || lower.includes(' change ')) {
                console.log('[PASSIVE] Escaping complex un-waked command to processCommand:', lower);
                processCommand(lower);
                return;
            }

            // Direct mood words — single word like "happy", "sad", "energetic"
            const singleMoodMap = {
                'happy': 'happy', 'sad': 'sad', 'calm': 'calm', 'focused': 'focused',
                'energetic': 'energetic', 'stressed': 'stressed', 'angry': 'angry', 'tired': 'tired'
            };
            if (singleMoodMap[lower]) {
                console.log('[PASSIVE] Direct single-word mood:', lower);
                handleDetectedMood(singleMoodMap[lower]);
                return;
            }

            // Check for genre switch (with OR without "play"/"switch"/"change")
            for (const [keyword, genre] of Object.entries(GENRE_MAP)) {
                if (lower === keyword || (lower.includes(keyword) && (lower.includes('play') || lower.includes('switch') || lower.includes('change')))) {
                    console.log('[PASSIVE] Direct genre detected:', genre);
                    setActiveGenre(genre);
                    window.SpotifyService.playMood(moodRef.current, genre, langRef.current);
                    say(`Switching to ${genre}.`);
                    addLog(`Passive genre change: ${genre}`, 'command');
                    return;
                }
            }

            // Direct language — e.g. just saying "hindi" or "english"
            for (const [keyword, language] of Object.entries(LANGUAGE_MAP)) {
                if (lower === keyword) {
                    console.log('[PASSIVE] Direct language:', language);
                    const p = {...profile, music_language: language};
                    setProfile(p); window.ProfileService.saveProfile(p);
                    langRef.current = language;
                    window.SpotifyService.playMood(moodRef.current, genreRef.current, language);
                    say(`Switching to ${language} songs.`);
                    return;
                }
            }

            // Check for ML mood with sentiment context
            // Guard: require at least 3 chars and block noise fragments like single phonemes
            const moodResult = (lower.length >= 3 && window.MoodDetector)
                ? window.MoodDetector.detect(lower)
                : null;
            if (moodResult && moodResult.confidence === 'HIGH') {
                console.log('[PASSIVE] ML mood detected:', moodResult.mood);
                handleDetectedMood(moodResult.mood);
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
        handleDirectCommandRef.current = processCommand;
    });

    const handleSkip = () => {
        const now = Date.now();
        if (now - lastSkipTimeRef.current > 15 * 60 * 1000) {
            skipCountRef.current = 0;
        }
        skipCountRef.current += 1;
        lastSkipTimeRef.current = now;

        const skips = window.ProfileService.onSkip('current_track_proxy');
        if (skips >= 5) {
            // BUG FIX: Use genreRef.current — activeGenre is a stale closure inside handleSkip
            const currentGenre = genreRef.current || activeGenre || 'mix';
            const gr = window.ProfileService.getGenreRotation();
            const currentIdx = gr.indexOf(currentGenre);
            const nextGenreIdx = currentIdx < 0 ? 0 : (currentIdx + 1) % gr.length;
            const newGenre = gr[nextGenreIdx];
            
            window.ProfileService.resetSkipCount();
            if (newGenre !== activeGenre) genreStartTimeRef.current = Date.now();
            setActiveGenre(newGenre);
            genreRef.current = newGenre;
            
            addLog(`5-skip rotation: ${currentGenre} -> ${newGenre}`, "system", "HIGH");
            say(`Let's try some ${newGenre} music instead.`, () => {
                window.SpotifyService.playMood(moodRef.current, newGenre, langRef.current);
            });
        } else {
            window.SpotifyService.nextSong();
            say("Skipping.");
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

    // Phase 4: Smart Popup Notification Engine
    useEffect(() => {
        if (!initialized || !profile) return;
        const iv = setInterval(() => {
            if (isDND) return; // Suppress entirely on DND
            
            const now = Date.now();
            const date = new Date();
            const hour = date.getHours();
            const day = date.getDay(); // 0 is Sunday, 6 is Saturday
            const shown = shownNotificationsRef.current;
            const trigger = (id, message, actionText, onAction) => {
                if (shown.has(id)) return;
                shown.add(id);
                setNotification({ id, message, actionText, onAction });
                addLog(`Popup Triggered: ${id}`, 'system', 'MEDIUM');
                setTimeout(() => setNotification(null), 8000); // 8s auto-dismiss
            };

            // 1. Morning Greeting (6am-12pm first open)
            if (hour >= 6 && hour < 12 && !shown.has('morning_greeting')) {
                trigger('morning_greeting', `Good morning ${profile.name}! Ready to start the day with some ${profile.default_mood || 'calm'} music?`, 'Play default', () => applyMoodLogic(profile.default_mood));
            }
            // 2. Evening Wind Down (8pm-11pm)
            else if (hour >= 20 && hour < 23 && !shown.has('evening_wind_down')) {
                trigger('evening_wind_down', `It's getting late ${profile.name}. Want something calm to wind down?`, 'Play calm', () => applyMoodLogic('calm'));
            }
            // 3. Study Session Detected (focused for 20+ min)
            else if (moodRef.current === 'focused' && (now - moodStartTime > 20 * 60 * 1000) && !shown.has('study_break')) {
                trigger('study_break', `You've been in focus mode for 20 minutes. Taking a break soon?`, 'Switch to relaxed', () => applyMoodLogic('calm'));
            }
            // 4. Negative Mood Check-in (sad/stressed/angry for 15+ min)
            else if (['sad', 'stressed', 'angry'].includes(moodRef.current) && (now - moodStartTime > 15 * 60 * 1000) && !shown.has('negative_mood')) {
                trigger('negative_mood', `You've been feeling ${moodRef.current} for a while. Want me to play something to lift your spirits?`, 'Lift spirits', () => handleDetectedMood(moodRef.current));
            }
            // 5. Genre Rotation Suggestion (same genre 45+ minutes)
            else if ((now - genreStartTimeRef.current > 45 * 60 * 1000) && !shown.has('genre_stale')) {
                trigger('genre_stale', `You've been listening to ${genreRef.current} for a while. Want to try something different?`, 'Rotate genre', () => {
                    const gr = window.ProfileService.getGenreRotation();
                    const newG = gr[(gr.indexOf(genreRef.current) + 1) % gr.length] || 'pop';
                    applyMoodLogic(moodRef.current, newG, 'manual_genre');
                });
            }
            // 6. Weekend Vibe (Sat/Sun midday)
            else if ((day === 0 || day === 6) && hour > 10 && hour < 18 && !shown.has('weekend_vibe')) {
                trigger('weekend_vibe', `It's the weekend! Want to switch to something more relaxed or energetic?`, 'Play energetic', () => applyMoodLogic('energetic'));
            }
            // 7. High Skip Rate (5+ skips in 10 minutes)
            else if (skipCountRef.current >= 5 && (now - lastSkipTimeRef.current < 10 * 60 * 1000) && !shown.has('high_skip')) {
                trigger('high_skip', `You've skipped a lot of songs. Should I try a completely different genre?`, 'Change genre', () => {
                    skipCountRef.current = 0;
                    applyMoodLogic(moodRef.current, 'jazz', 'manual_genre'); 
                });
            }
            // 8. New User Welcome (handled implicitly during onboarding, but a secondary reminder helps)
            else if (profile.mood_history && profile.mood_history.length < 2 && !shown.has('new_user_tip')) {
                trigger('new_user_tip', `Welcome to AURA ${profile.name}! Say Aura anytime to control your music.`, 'Got it', null);
            }
            // 9. Mood Streak (same positive mood 3+ sessions in a row) - simplified
            else if (['happy', 'energetic', 'calm'].includes(moodRef.current) && profile.mood_history?.slice(-3).every(m => m.mood === moodRef.current) && !shown.has('mood_streak')) {
                trigger('mood_streak', `You've been in a great mood lately ${profile.name}! Keep it up.`, 'Thanks', null);
            }
            // 10. Inactivity Detected (no voice command for 30+ minutes)
            else if ((now - lastVoiceCommandTimeRef.current > 30 * 60 * 1000) && !shown.has('inactivity')) {
                trigger('inactivity', `Still there ${profile.name}? Say Aura if you want to change anything.`, "I'm here", () => lastVoiceCommandTimeRef.current = Date.now());
            }
            // 11. Late Night (12am-4am)
            else if (hour >= 0 && hour < 4 && !shown.has('late_night')) {
                trigger('late_night', `You're up late ${profile.name}. Want something calm or are you still going strong?`, 'Play calm', () => applyMoodLogic('calm'));
            }
            // 12. Monday Motivation (Monday morning)
            else if (day === 1 && hour >= 6 && hour < 11 && !shown.has('monday_motivation')) {
                trigger('monday_motivation', `Monday again ${profile.name}. Let me play something to help you start the week right.`, 'Play energetic', () => applyMoodLogic('energetic'));
            }

        }, 60000); // Check every 60s
        return () => clearInterval(iv);
    }, [initialized, profile, isDND]);

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
                            setInterimText(""); addLog(`Manual Overide: ${m}`, 'direct', 'HIGH');
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
                        isMicMuted={isMicMuted} setIsMicMuted={(val) => {
                            setIsMicMuted(val);
                            localStorage.setItem('aura_mic_muted', val.toString());
                        }}
                        isDND={isDND} setIsDND={setIsDND}
                        notification={notification} setNotification={setNotification}
                        handleTextSubmitDirect={(text) => {
                            const trimmed = text.toLowerCase().trim();
                            if (['mute', 'mute mic'].includes(trimmed)) { setIsMicMuted(true); localStorage.setItem('aura_mic_muted', 'true'); }
                            else if (['unmute', 'unmute mic'].includes(trimmed)) { setIsMicMuted(false); localStorage.setItem('aura_mic_muted', 'false'); }
                            else if (['dnd on', 'do not disturb'].includes(trimmed)) { setIsDND(true); }
                            else if (['dnd off'].includes(trimmed)) { setIsDND(false); }
                            else { processCommand(trimmed); }
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
