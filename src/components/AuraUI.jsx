const { useState, useEffect, useRef, useMemo } = React;

const AuraUI = ({ 
    children, micActive = false, orbSpeaking = false, statusText = '', logs = [], mood = 'calm', setMood, listeningMode = 'passive', interimText = '', 
    isPlaying = false, language = 'English', onChangeLanguage, onLogout, lyricsText = '', lyricsLoading = false, 
    currentPosMs = 0, trackDuration = 1000, activeGenre = 'pop', onChangeGenre, toastMsg = '', pendingConfirmation = null, onConfirmMood, 
    wakeTimeRemaining = null, trackInfo = {name: '', artist: ''}, profile = {onboarded: true}, onOrbClick, geminiStatus = 'checking', micStatus = 'failed',
    isMicMuted = false, setIsMicMuted, isDND = false, setIsDND, notification = null, setNotification, handleTextSubmitDirect
}) => {
    const isChromeEdge = /Chrome/.test(navigator.userAgent) || /Edg/.test(navigator.userAgent);
    const isPassive = listeningMode === 'passive';
    
    const [cursorPos, setCursorPos] = useState({ x: -100, y: -100 });
    const [parallax, setParallax] = useState({ x: 0, y: 0 });
    const [micTestActive, setMicTestActive] = useState(false);
    const [dismissMusicTip, setDismissMusicTip] = useState(localStorage.getItem('aura_music_tip') === 'true');
    
    // Sidebar (lyrics) state — auto-hide
    const [sidebarVisible, setSidebarVisible] = useState(false);
    const hideTimerRef = useRef(null);

    // Floating card states
    const [showSettings, setShowSettings] = useState(false);
    const [showProfile, setShowProfile] = useState(false);

    // Text input
    const [textInput, setTextInput] = useState('');

    // Auto-detect if music started for the first time
    const [hasPlayedMusic, setHasPlayedMusic] = useState(false);
    useEffect(() => {
        if (isPlaying && !hasPlayedMusic) setHasPlayedMusic(true);
    }, [isPlaying, hasPlayedMusic]);

    // Progress percent
    const progressPercent = trackDuration > 0 ? Math.min(100, (currentPosMs / trackDuration) * 100) : 0;

    // ── Sidebar hover logic ──────────────────────────────────────────────
    const triggerZoneRef = useRef(null);
    const sidebarRef = useRef(null);

    useEffect(() => {
        const triggerZone = document.createElement('div');
        triggerZone.style.cssText = `
            position: fixed; right: 0; top: 0;
            width: 20px; height: 100vh;
            z-index: 999; pointer-events: auto;
        `;
        document.body.appendChild(triggerZone);
        triggerZoneRef.current = triggerZone;

        const showSidebar = () => {
            clearTimeout(hideTimerRef.current);
            setSidebarVisible(true);
        };
        const scheduleSidebarHide = () => {
            hideTimerRef.current = setTimeout(() => setSidebarVisible(false), 1000);
        };

        triggerZone.addEventListener('mouseenter', showSidebar);

        return () => {
            triggerZone.removeEventListener('mouseenter', showSidebar);
            document.body.removeChild(triggerZone);
            clearTimeout(hideTimerRef.current);
        };
    }, []);

    const handleSidebarMouseEnter = () => {
        clearTimeout(hideTimerRef.current);
        setSidebarVisible(true);
    };
    const handleSidebarMouseLeave = () => {
        hideTimerRef.current = setTimeout(() => setSidebarVisible(false), 1000);
    };

    // Close floating cards when clicking outside — mousedown fires before click,
    // and explicit ID/class guards prevent the buttons from triggering a close.
    useEffect(() => {
        const handleClickOutside = (e) => {
            // These guards prevent the outside click handler from firing when clicking the buttons
            if (e.target.closest('#aura-settings-btn') || e.target.closest('#aura-profile-btn')) return;
            // These guards prevent the handler from firing when clicking inside the cards
            if (e.target.closest('.settings-card') || e.target.closest('.profile-card')) return;
            
            setShowSettings(false);
            setShowProfile(false);
        };
        // Use mousedown to catch the start of the click before it propagates fully
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const testMicrophone = () => {
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                stream.getTracks().forEach(t => t.stop());
                const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
                if (!SR) return;
                const test = new SR();
                test.lang = 'en-US'; test.continuous = false;
                test.onstart = () => console.log('[MIC TEST] ✅ Started');
                test.onresult = (e) => console.log('[MIC TEST] ✅ Heard:', e.results[0][0].transcript);
                test.onerror = (e) => console.error('[MIC TEST] ❌ Error:', e.error);
                test.start();
            })
            .catch(err => alert('Microphone hardware access denied.'));
    };

    const hardResetSpeech = () => {
        if (window.SpeechService) {
            window.SpeechService.stop();
            window.SpeechService.recognition = null;
        }
        setTimeout(() => {
            if (window.SpeechService?.start) window.SpeechService.start();
        }, 1000);
    };

    const moodMap = {
        happy:    { color: '#00e5ff', bg: 'rgba(0, 38, 51, 0.5)' },
        sad:      { color: '#8e24aa', bg: 'rgba(26, 0, 51, 0.5)' },
        calm:     { color: '#00d2ff', bg: 'rgba(0, 26, 51, 0.5)' },
        focused:  { color: '#4d4dff', bg: 'rgba(13, 13, 51, 0.5)' },
        energetic:{ color: '#ff007f', bg: 'rgba(51, 0, 26, 0.5)' },
        stressed: { color: '#ff6600', bg: 'rgba(51, 20, 0, 0.5)' },
        angry:    { color: '#ff003c', bg: 'rgba(43, 0, 10, 0.5)' },
        tired:    { color: '#4a00e0', bg: 'rgba(16, 0, 51, 0.5)' }
    };
    
    const activeMood = moodMap[mood] || moodMap['calm'];
    
    let waveState = 'idle';
    if (orbSpeaking) waveState = 'speaking';
    else if (micActive && !isPassive) waveState = 'listening';
    else if (isPlaying) waveState = 'playing';

    const canvasRef = useRef(null);
    let lastPos = useRef({x: 0, y: 0});

    useEffect(() => {
        const handleMouseMove = (e) => {
            setCursorPos({ x: e.clientX, y: e.clientY });
            const cx = window.innerWidth / 2;
            const cy = window.innerHeight / 2;
            setParallax({ x: (e.clientX - cx) / 40, y: (e.clientY - cy) / 40 });

            if (canvasRef.current) {
                const ctx = canvasRef.current.getContext('2d');
                if (lastPos.current.x === 0 && lastPos.current.y === 0) {
                    lastPos.current = {x: e.clientX, y: e.clientY};
                }
                ctx.beginPath();
                ctx.moveTo(lastPos.current.x, lastPos.current.y);
                ctx.lineTo(e.clientX, e.clientY);
                ctx.strokeStyle = activeMood.color + '99';
                ctx.lineWidth = Math.random() * 8 + 6;
                ctx.lineCap = 'round';
                ctx.stroke();
            }
            lastPos.current = {x: e.clientX, y: e.clientY};
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [activeMood]);

    useEffect(() => {
        let anim;
        const resize = () => {
            if (canvasRef.current) {
                canvasRef.current.width = window.innerWidth;
                canvasRef.current.height = window.innerHeight;
            }
        };
        window.addEventListener('resize', resize);
        resize();

        const fade = () => {
            if (canvasRef.current) {
                const ctx = canvasRef.current.getContext('2d');
                ctx.globalCompositeOperation = 'destination-out';
                ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
                ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                ctx.globalCompositeOperation = 'source-over';
            }
            anim = requestAnimationFrame(fade);
        };
        fade();
        return () => { cancelAnimationFrame(anim); window.removeEventListener('resize', resize); };
    }, []);

    // Lyrics parsing
    const parsedLyrics = useMemo(() => {
        if (!lyricsText || lyricsText === "Loading lyrics..." || lyricsText.includes("Lyrics not available")) return [];
        const lines = lyricsText.split('\n').filter(l => l.trim().length > 0);
        let hasLrc = false;
        
        const parsed = lines.map(line => {
            const match = line.match(/^\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
            if (match) {
                hasLrc = true;
                const min = parseInt(match[1]);
                const sec = parseInt(match[2]);
                const msRaw = parseInt(match[3]);
                const ms = match[3].length === 2 ? msRaw * 10 : msRaw;
                return { time: (min * 60 + sec) * 1000 + ms, text: match[4].trim() };
            }
            return { time: -1, text: line.trim() };
        });

        if (hasLrc) {
            return parsed.filter(p => p.time !== -1 && p.text);
        } else {
            const timePerLine = trackDuration / Math.max(1, lines.length);
            return lines.map((line, idx) => ({ time: idx * timePerLine, text: line.trim() }));
        }
    }, [lyricsText, trackDuration]);

    const activeLineIndex = useMemo(() => {
        for (let i = parsedLyrics.length - 1; i >= 0; i--) {
            if (currentPosMs + 300 >= parsedLyrics[i].time) return i;
        }
        return 0;
    }, [currentPosMs, parsedLyrics]);

    const lyricsContainerRef = useRef(null);
    const activeLineRef = useRef(null);

    useEffect(() => {
        if (activeLineRef.current && lyricsContainerRef.current && sidebarVisible) {
            lyricsContainerRef.current.scrollTo({
                top: activeLineRef.current.offsetTop - lyricsContainerRef.current.clientHeight / 2,
                behavior: 'smooth'
            });
        }
    }, [activeLineIndex, sidebarVisible]);

    const handleTextSubmit = () => {
        const trimmed = textInput.trim();
        if (!trimmed) return;
        if (handleTextSubmitDirect) {
            handleTextSubmitDirect(trimmed);
        } else if (window.handleDirectCommand) {
            window.handleDirectCommand(trimmed);
        } else if (window.handleSpeechResult) {
            window.handleSpeechResult(trimmed, 1.0);
        }
        setTextInput('');
    };

    return (
        <div style={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
            <canvas id="slash-canvas" ref={canvasRef} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}></canvas>

            {/* Custom Glowing Cursor */}
            <div className="aura-cursor" style={{ left: cursorPos.x, top: cursorPos.y, background: `radial-gradient(circle, ${activeMood.color}88 0%, rgba(255,255,255,0) 70%)` }}></div>

            {/* Ambient edge glow */}
            <div style={{
                position: 'absolute', inset: 0,
                boxShadow: `inset 0 0 50px ${wakeTimeRemaining === 0 ? '#ef4444' : activeMood.color}`,
                transition: 'box-shadow 0.5s ease-in-out', zIndex: 0, pointerEvents: 'none'
            }}></div>

            {/* ── TOP BAR ── */}
            <div style={{ zIndex: 10000, padding: '20px', position: 'fixed', top: 0, left: 0, right: 0, display: 'flex', gap: 20, color: activeMood.color, fontWeight: 'bold', transition: 'color 1.5s ease', alignItems: 'center' }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', letterSpacing: 2 }}>AURA OS</span>
                <span style={{ opacity: 0.7, fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>
                    {listeningMode === 'passive' ? 'PASSIVE LISTENING' : listeningMode === 'processing' ? 'PROCESSING...' : 'ACTIVE LISTENING'}
                </span>
                {wakeTimeRemaining !== null && wakeTimeRemaining > 0 && (
                    <span style={{ fontSize: 12, color: '#ef4444', fontFamily: 'JetBrains Mono, monospace' }}>
                        [{wakeTimeRemaining}s]
                    </span>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 10, background: 'rgba(0,0,0,0.4)', padding: '5px 12px', borderRadius: 20 }}>
                    <div style={{ 
                        width: 10, height: 10, borderRadius: '50%', 
                        background: geminiStatus === 'green' ? '#10b981' : (geminiStatus === 'orange' ? '#f59e0b' : (geminiStatus === 'red' ? '#ef4444' : '#6b7280')),
                        boxShadow: `0 0 8px ${geminiStatus === 'green' ? '#10b981' : (geminiStatus === 'orange' ? '#f59e0b' : (geminiStatus === 'red' ? '#ef4444' : 'transparent'))}`
                    }}></div>
                    <span style={{ fontSize: 12, color: '#fff', opacity: 0.8 }}>
                        {geminiStatus === 'green' ? 'Gemini Active' : (geminiStatus === 'orange' ? 'Offline Mode' : (geminiStatus === 'red' ? 'AI Offline' : 'Connecting...'))}
                    </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,0,0,0.4)', padding: '5px 12px', borderRadius: 20 }}>
                    <div className={`mic-dot ${micStatus}`} style={{ 
                        width: 10, height: 10, borderRadius: '50%', 
                        background: isMicMuted ? '#ef4444' : (micStatus === 'listening' ? '#10b981' : (micStatus === 'reconnecting' ? '#f59e0b' : '#ef4444')),
                        boxShadow: `0 0 8px ${isMicMuted ? '#ef4444' : (micStatus === 'listening' ? '#10b981' : (micStatus === 'reconnecting' ? '#f59e0b' : '#ef4444'))}`
                    }}></div>
                    <span style={{ fontSize: 12, color: '#fff', opacity: 0.8 }}>
                        {isMicMuted ? 'Mic Muted' : (micStatus === 'listening' ? 'Mic Active' : (micStatus === 'reconnecting' ? 'Reconnecting...' : 'Mic Off'))}
                    </span>
                </div>
                {isDND && (
                    <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.4)', padding: '5px 12px', borderRadius: 20 }} title="Do Not Disturb">
                        <span style={{ fontSize: 14 }}>🌙</span>
                    </div>
                )}

                {/* Spacer */}
                <div style={{ flex: 1 }} />

                {/* ── Circle buttons top-right ── */}
                <button
                    className="circle-btn"
                    title={isMicMuted ? "Unmute Mic" : "Mute Mic"}
                    onClick={e => { e.stopPropagation(); setIsMicMuted(!isMicMuted); }}
                    style={{ background: isMicMuted ? '#ef444433' : 'rgba(0,0,0,0.6)', borderColor: isMicMuted ? '#ef4444' : 'rgba(34, 211, 238, 0.4)', color: isMicMuted ? '#ef4444' : '#22d3ee' }}
                >
                    {isMicMuted ? '🔇' : '🎙️'}
                </button>
                <button
                    className="circle-btn"
                    title={isDND ? "Disable DND" : "Enable DND"}
                    onClick={e => { e.stopPropagation(); setIsDND(!isDND); }}
                    style={{ background: isDND ? '#f59e0b33' : 'rgba(0,0,0,0.6)', borderColor: isDND ? '#f59e0b' : 'rgba(34, 211, 238, 0.4)', color: isDND ? '#f59e0b' : '#22d3ee' }}
                >
                    {isDND ? '🌙' : '🔔'}
                </button>
                <button
                    id="aura-settings-btn"
                    className="circle-btn settings-btn"
                    title="Settings"
                    onClick={(e) => {
                        e.stopPropagation();
                        console.log('[UI] Settings clicked, current state:', showSettings);
                        setShowSettings(s => !s);
                        setShowProfile(false);
                    }}
                >⚙</button>
                <button
                    id="aura-profile-btn"
                    className="circle-btn profile-btn"
                    title="Profile"
                    onClick={(e) => {
                        e.stopPropagation();
                        console.log('[UI] Profile clicked, current state:', showProfile);
                        setShowProfile(s => !s);
                        setShowSettings(false);
                    }}
                >👤</button>
            </div>

            {/* ── Toasts / Confirmations / Notifications ── */}
            {notification && (
                <div className="glass-panel aura-notification" style={{ position: 'absolute', top: 20, right: 20, padding: '20px', zIndex: 10000, maxWidth: 350, border: `1px solid ${activeMood.color}`, boxShadow: `0 10px 30px ${activeMood.color}33`, animation: 'slide-in-right 0.3s forwards', backgroundColor: 'rgba(5,5,15,0.95)' }}>
                    <p style={{ margin: '0 0 15px 0', fontSize: 14, color: '#fff', fontWeight: 'bold' }}>{notification.message}</p>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        {notification.onAction && (
                            <button onClick={() => { notification.onAction(); setNotification(null); }} style={{ background: activeMood.color, color: '#000', border: 'none', padding: '6px 15px', borderRadius: 15, cursor: 'pointer', fontWeight: 'bold', fontSize: 12 }}>{notification.actionText}</button>
                        )}
                        <button onClick={() => setNotification(null)} style={{ background: 'transparent', color: '#9ca3af', border: '1px solid #9ca3af', padding: '6px 15px', borderRadius: 15, cursor: 'pointer', fontWeight: 'bold', fontSize: 12 }}>Dismiss</button>
                    </div>
                </div>
            )}
            
            {toastMsg && (
                <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', backgroundColor: '#fff', color: '#000', padding: '10px 30px', borderRadius: 25, zIndex: 200, fontWeight: 'bold', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>{toastMsg}</div>
            )}

            {pendingConfirmation && (
                <div className="glass-panel" style={{ position: 'absolute', top: 80, left: '50%', transform: 'translateX(-50%)', padding: '25px', zIndex: 200, textAlign: 'center' }}>
                    <p style={{ margin: '0 0 20px 0', fontSize: 16 }}>{pendingConfirmation.msg}</p>
                    <div style={{ display: 'flex', gap: 15, justifyContent: 'center' }}>
                        <button onClick={() => onConfirmMood(true)} style={{ background: '#1db954', color: '#fff', border: 'none', padding: '10px 25px', borderRadius: 20, cursor: 'pointer', fontWeight: 'bold' }}>Yes</button>
                        <button onClick={() => onConfirmMood(false)} style={{ background: '#374151', color: '#fff', border: 'none', padding: '10px 25px', borderRadius: 20, cursor: 'pointer', fontWeight: 'bold' }}>No</button>
                    </div>
                </div>
            )}

            {hasPlayedMusic && !dismissMusicTip && (
                <div style={{ position: 'absolute', top: 70, left: '50%', transform: 'translateX(-50%)', background: 'rgba(29, 185, 84, 0.9)', color: '#fff', padding: '10px 20px', borderRadius: 10, zIndex: 200, display: 'flex', alignItems: 'center', gap: 15, boxShadow: '0 5px 15px rgba(0,0,0,0.5)' }}>
                    <span style={{ fontSize: 14, fontWeight: 'bold' }}>Tip: Use headphones so AURA does not pick up music through your microphone.</span>
                    <button onClick={() => { setDismissMusicTip(true); localStorage.setItem('aura_music_tip', 'true'); }} style={{ background: 'transparent', border: '1px solid currentColor', color: 'currentColor', padding: '4px 10px', borderRadius: 4, cursor: 'pointer' }}>Dismiss</button>
                </div>
            )}

            {/* ── SETTINGS Floating Card ── */}
            {showSettings && (
                <div
                    className="aura-floating-card glass-panel settings-card"
                    onClick={e => e.stopPropagation()}
                    style={{
                        position: 'fixed', top: '70px', right: '70px',
                        width: '300px', zIndex: 9999, padding: '24px',
                        overflow: 'auto', maxHeight: 'calc(100vh - 100px)',
                        background: 'rgba(5,5,20,0.97)',
                        border: `1px solid ${activeMood.color}`,
                        borderRadius: '16px',
                        boxShadow: `0 0 40px ${activeMood.color}33`
                    }}
                >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <h4 style={{ margin: 0, color: activeMood.color, fontFamily: 'JetBrains Mono', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' }}>⚙ Settings</h4>
                        <button onClick={e => { e.stopPropagation(); setShowSettings(false); }} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>✕</button>
                    </div>

                    <div style={{ marginBottom: 22 }}>
                        <p style={{ margin: '0 0 10px 0', color: '#9ca3af', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'JetBrains Mono' }}>Mood Override</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {Object.keys(moodMap).map(m => (
                                <button key={m} className={`filter-btn ${mood === m ? 'active' : ''}`}
                                    onClick={e => { e.stopPropagation(); setMood(m); }}
                                    style={{ '--active-color': moodMap[m].color, '--active-bg': moodMap[m].bg }}>
                                    {m}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={{ marginBottom: 22 }}>
                        <p style={{ margin: '0 0 10px 0', color: '#9ca3af', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'JetBrains Mono' }}>Genre</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {['pop', 'lo-fi', 'rock', 'classical', 'hip-hop', 'jazz', 'electronic', 'metal'].map(g => (
                                <button key={g} className={`filter-btn ${activeGenre === g ? 'active' : ''}`}
                                    onClick={e => { e.stopPropagation(); if (onChangeGenre) onChangeGenre(g); }}
                                    style={{ '--active-color': activeMood.color, '--active-bg': activeMood.bg }}>
                                    {g}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={{ marginBottom: 22 }}>
                        <p style={{ margin: '0 0 10px 0', color: '#9ca3af', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'JetBrains Mono' }}>Language</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {['English', 'Hindi', 'Spanish', 'Korean', 'Arabic', 'French', 'Japanese'].map(lang => (
                                <button key={lang} className={`filter-btn ${language === lang ? 'active' : ''}`}
                                    onClick={e => { e.stopPropagation(); if (onChangeLanguage) onChangeLanguage(lang); }}
                                    style={{ '--active-color': activeMood.color, '--active-bg': activeMood.bg }}>
                                    {lang}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16 }}>
                        <p style={{ margin: '0 0 10px 0', color: '#9ca3af', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'JetBrains Mono' }}>Diagnostics</p>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <button onClick={e => { e.stopPropagation(); testMicrophone(); }} style={{ background: '#f59e0b', color: '#000', padding: '8px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: 11 }}>Test Mic</button>
                            <button onClick={e => { e.stopPropagation(); hardResetSpeech(); }} style={{ background: '#ef4444', color: '#fff', padding: '8px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: 11 }}>Reset Mic</button>
                            {onLogout && <button onClick={e => { e.stopPropagation(); onLogout(); }} style={{ background: '#374151', color: '#fff', padding: '8px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: 11 }}>Logout</button>}
                        </div>
                    </div>
                </div>
            )}

            {/* ── PROFILE Floating Card ── */}
            {showProfile && (() => {
                const p = window.ProfileService ? window.ProfileService.getProfile() : (profile || {});
                const moodHistory = Array.isArray(p.mood_history) ? p.mood_history : [];
                const recentMoods = moodHistory.slice(-5).reverse();
                const topMood = moodHistory.length > 0
                    ? Object.entries(moodHistory.reduce((acc, e) => { acc[e.mood] = (acc[e.mood] || 0) + 1; return acc; }, {})).sort((a,b) => b[1]-a[1])[0]?.[0]
                    : 'N/A';

                return (
                    <div
                        className="aura-floating-card glass-panel profile-card"
                        onClick={e => e.stopPropagation()}
                        style={{
                            position: 'fixed', top: '70px', right: '20px',
                            width: '300px', zIndex: 9999, padding: '24px',
                            overflow: 'auto', maxHeight: 'calc(100vh - 100px)',
                            background: 'rgba(5,5,20,0.97)',
                            border: `1px solid ${activeMood.color}`,
                            borderRadius: '16px',
                            boxShadow: `0 0 40px ${activeMood.color}33`
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <h4 style={{ margin: 0, color: activeMood.color, fontFamily: 'JetBrains Mono', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' }}>👤 Profile</h4>
                            <button onClick={e => { e.stopPropagation(); setShowProfile(false); }} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>✕</button>
                        </div>

                        {/* Identity */}
                        <div style={{ marginBottom: 20, padding: '14px', background: 'rgba(255,255,255,0.04)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div style={{ fontSize: 22, fontWeight: 'bold', color: '#fff', fontFamily: 'Instrument Serif, serif' }}>{p.name || 'Anonymous'}</div>
                            <div style={{ fontSize: 12, color: activeMood.color, marginTop: 4, opacity: 0.8, fontFamily: 'JetBrains Mono' }}>{p.listening_context || 'listener'} · {p.music_language || 'English'}</div>
                        </div>

                        {/* Stats grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                            <div className="stat-card">
                                <h3>Top Mood</h3>
                                <div className="stat-value" style={{ fontSize: 16, '--active-color': activeMood.color }}>{topMood}</div>
                            </div>
                            <div className="stat-card">
                                <h3>Default</h3>
                                <div className="stat-value" style={{ fontSize: 16, '--active-color': activeMood.color }}>{p.default_mood || 'calm'}</div>
                            </div>
                            <div className="stat-card">
                                <h3>Genre</h3>
                                <div className="stat-value" style={{ fontSize: 14, '--active-color': activeMood.color }}>{p.preferred_genre || 'mix'}</div>
                            </div>
                            <div className="stat-card">
                                <h3>Sessions</h3>
                                <div className="stat-value" style={{ fontSize: 16, '--active-color': activeMood.color }}>{moodHistory.length}</div>
                            </div>
                        </div>

                        {/* Recent mood history */}
                        {recentMoods.length > 0 && (
                            <div style={{ marginBottom: 20 }}>
                                <p style={{ margin: '0 0 10px 0', color: '#9ca3af', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'JetBrains Mono' }}>Recent Moods</p>
                                {recentMoods.map((entry, i) => (
                                    <div key={i} className="history-item">
                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: moodMap[entry.mood]?.color || '#fff', marginRight: 10, flexShrink: 0 }} />
                                        <span className="history-mood" style={{ flex: 1 }}>{entry.mood}</span>
                                        <span className="history-method">{entry.detection_method || 'manual'}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Logout */}
                        {onLogout && (
                            <button
                                onClick={e => { e.stopPropagation(); onLogout(); }}
                                style={{ width: '100%', background: '#7f1d1d', color: '#fff', padding: '10px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: 12, fontFamily: 'JetBrains Mono', letterSpacing: 1 }}
                            >Logout</button>
                        )}
                    </div>
                );
            })()}

            {/* ── MAIN CENTERED CONTENT ── */}
            <div className="main-content" style={{ zIndex: 10, position: 'absolute', inset: 0 }}>

                {/* Orb with parallax */}
                <div className="parallax-wrapper" style={{ transform: `rotateX(${-parallax.y}deg) rotateY(${parallax.x}deg)` }}>
                    <div className="parallax-layer" style={{ transform: 'translateZ(-50px)' }}></div>

                    <div className="parallax-layer" style={{ transform: 'translateZ(20px)' }}>
                        <div className={`orb-container ${orbSpeaking ? 'speaking' : ''} ${micActive && !isPassive ? 'listening' : ''} ${isPassive ? 'passive' : ''} ${isPlaying ? 'playing' : ''}`} onClick={onOrbClick} style={{ cursor: onOrbClick ? 'pointer' : 'default' }}>
                            <div className="ripple-container">
                                <div className="ripple r1" style={{borderColor: activeMood.color}}></div>
                                <div className="ripple r2" style={{borderColor: activeMood.color}}></div>
                            </div>
                            <div className="ring ring-outer" style={{ borderColor: activeMood.color, opacity: 0.5 }}>
                                <div className="orbit-dot dot-1" style={{ backgroundColor: activeMood.color, boxShadow: `0 0 10px ${activeMood.color}` }}></div>
                            </div>
                            <div className="ring ring-mid" style={{ borderColor: activeMood.color, opacity: 0.7 }}>
                                <div className="orbit-dot dot-2" style={{ backgroundColor: activeMood.color, boxShadow: `0 0 10px ${activeMood.color}` }}></div>
                            </div>
                            <div className="ring ring-inner" style={{ borderColor: activeMood.color, opacity: 1.0 }}>
                                <div className="orbit-dot dot-3" style={{ backgroundColor: activeMood.color, boxShadow: `0 0 10px ${activeMood.color}` }}></div>
                            </div>
                            <div className="core" style={{ 
                                borderColor: wakeTimeRemaining === 0 ? '#ef4444' : activeMood.color, 
                                boxShadow: wakeTimeRemaining === 0 ? '0 0 30px rgba(239, 68, 68, 0.8)' : (listeningMode === 'active_manual' ? `0 0 60px ${activeMood.color}, 0 0 30px #fff` : `0 0 30px ${activeMood.bg}`),
                                transform: listeningMode === 'active_manual' ? 'scale(1.15)' : 'scale(1)',
                                transition: 'all 0.3s ease',
                                backgroundColor: listeningMode === 'active_manual' ? `${activeMood.color}33` : '#030712'
                            }}>
                                <h1 style={{ color: activeMood.color, textShadow: `0 0 15px ${activeMood.color}` }}>A</h1>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Status text */}
                <div style={{ textAlign: 'center' }}>
                    <h2 style={{ color: activeMood.color, fontSize: '22px', transition: 'color 0.5s ease', margin: 0, textShadow: `0 0 20px ${activeMood.color}`, fontFamily: 'JetBrains Mono, monospace' }}>{statusText}</h2>
                    {interimText && <p style={{ margin: '8px 0 0', color: '#e5e7eb', fontStyle: 'italic', fontSize: 16 }}>{interimText}...</p>}
                </div>

                {/* ── Dynamic Audio Visualizer ── */}
                <div style={{ display: 'flex', gap: '4px', height: '40px', alignItems: 'center', justifyContent: 'center', opacity: (waveState === 'speaking' || waveState === 'listening') ? 1 : 0, transition: 'opacity 0.3s ease' }}>
                    {[...Array(7)].map((_, i) => (
                        <div key={i} className={`wave-bar ${waveState}`} style={{
                            width: '6px',
                            background: activeMood.color,
                            borderRadius: '3px',
                            animationDelay: `${i * 0.15}s`,
                            boxShadow: `0 0 10px ${activeMood.color}88`
                        }}></div>
                    ))}
                </div>

                {/* Track Name + Artist */}
                <div style={{ textAlign: 'center' }}>
                    <div style={{
                        color: 'white', fontSize: '18px', fontWeight: 'bold',
                        fontFamily: 'JetBrains Mono, monospace',
                        textShadow: `0 0 10px ${activeMood.color}88`,
                        maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                        {trackInfo?.name || 'No track playing'}
                    </div>
                    <div style={{ color: activeMood.color, opacity: 0.75, fontSize: '13px', fontFamily: 'JetBrains Mono, monospace', marginTop: '4px' }}>
                        {trackInfo?.artist || ''}
                    </div>
                </div>

                {/* ── Playback Controls ── */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
                    <button
                        title="Previous"
                        onClick={() => window.SpotifyService?.previousSong?.()}
                        style={{ cursor: 'pointer', background: 'rgba(0,0,0,0.6)', color: activeMood.color, border: `1.5px solid ${activeMood.color}88`, borderRadius: '50%', width: 48, height: 48, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 12px ${activeMood.color}44`, transition: 'all 0.2s', backdropFilter: 'blur(10px)' }}
                        onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 0 22px ${activeMood.color}bb`; e.currentTarget.style.borderColor = activeMood.color; }}
                        onMouseLeave={e => { e.currentTarget.style.boxShadow = `0 0 12px ${activeMood.color}44`; e.currentTarget.style.borderColor = `${activeMood.color}88`; }}
                    >⏮</button>

                    <button
                        title={isPlaying ? 'Pause' : 'Play'}
                        onClick={() => { if (!window.SpotifyService) return; isPlaying ? window.SpotifyService.pause() : window.SpotifyService.resume(); }}
                        style={{ cursor: 'pointer', background: `${activeMood.color}22`, color: activeMood.color, border: `2px solid ${activeMood.color}`, borderRadius: '50%', width: 66, height: 66, fontSize: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 24px ${activeMood.color}66`, transition: 'all 0.2s', backdropFilter: 'blur(10px)' }}
                        onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 0 40px ${activeMood.color}cc`; e.currentTarget.style.background = `${activeMood.color}44`; }}
                        onMouseLeave={e => { e.currentTarget.style.boxShadow = `0 0 24px ${activeMood.color}66`; e.currentTarget.style.background = `${activeMood.color}22`; }}
                    >{isPlaying ? '⏸' : '▶'}</button>

                    <button
                        title="Next"
                        onClick={() => window.SpotifyService?.nextSong?.()}
                        style={{ cursor: 'pointer', background: 'rgba(0,0,0,0.6)', color: activeMood.color, border: `1.5px solid ${activeMood.color}88`, borderRadius: '50%', width: 48, height: 48, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 12px ${activeMood.color}44`, transition: 'all 0.2s', backdropFilter: 'blur(10px)' }}
                        onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 0 22px ${activeMood.color}bb`; e.currentTarget.style.borderColor = activeMood.color; }}
                        onMouseLeave={e => { e.currentTarget.style.boxShadow = `0 0 12px ${activeMood.color}44`; e.currentTarget.style.borderColor = `${activeMood.color}88`; }}
                    >⏭</button>
                </div>

                {/* Player children (Pause/Play from App.jsx) */}
                {children && <div>{children}</div>}

                {/* ── Progress Bar ── */}
                <div style={{ width: '400px', maxWidth: '90vw', height: '3px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{
                        width: `${progressPercent}%`,
                        height: '100%',
                        background: `linear-gradient(90deg, ${activeMood.color}, #8b5cf6)`,
                        borderRadius: '2px',
                        transition: 'width 0.3s ease'
                    }} />
                </div>

                {/* ── Text Input ── */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '420px', maxWidth: '90vw' }}>
                    <input
                        type="text"
                        placeholder="Type a command or how you feel..."
                        value={textInput}
                        onChange={e => setTextInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleTextSubmit(); }}
                        style={{
                            flex: 1,
                            background: 'rgba(0,0,0,0.5)',
                            border: `1px solid ${activeMood.color}44`,
                            borderRadius: '25px',
                            padding: '12px 20px',
                            color: activeMood.color,
                            fontFamily: 'JetBrains Mono, monospace',
                            fontSize: '13px',
                            outline: 'none',
                            backdropFilter: 'blur(10px)',
                            transition: 'border-color 0.3s'
                        }}
                        onFocus={e => e.target.style.borderColor = activeMood.color}
                        onBlur={e => e.target.style.borderColor = `${activeMood.color}44`}
                    />
                    <button
                        onClick={handleTextSubmit}
                        style={{
                            width: 44, height: 44, borderRadius: '50%',
                            background: `${activeMood.color}33`,
                            border: `1.5px solid ${activeMood.color}`,
                            color: activeMood.color,
                            fontSize: 18, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.2s',
                            backdropFilter: 'blur(10px)'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = `${activeMood.color}66`}
                        onMouseLeave={e => e.currentTarget.style.background = `${activeMood.color}33`}
                    >➤</button>
                </div>

                {/* ── Command Log ── */}
                <div className="glass-panel" style={{ padding: '12px 20px', width: '420px', maxWidth: '90vw', border: `1px solid ${activeMood.color}33` }}>
                    {logs.slice(-4).map((L, i) => {
                        let c = activeMood.color;
                        if (L.confidence === 'HIGH') c = '#22c55e'; 
                        else if (L.confidence === 'MEDIUM') c = '#06b6d4'; 
                        const opacity = (i + 1) / Math.min(4, logs.length);
                        return <div key={i} style={{ color: c, fontSize: '11px', marginBottom: 4, fontFamily: 'JetBrains Mono', opacity }}>{'>'} {L.text || L}</div>;
                    })}
                </div>
            </div>

            {/* ── LYRICS AUTO-HIDE SIDEBAR ── */}
            {/* Small always-visible pull tab */}
            <div
                className="sidebar-tab"
                onClick={() => setSidebarVisible(v => !v)}
                style={{
                    position: 'fixed',
                    right: sidebarVisible ? '320px' : '0',
                    top: 'calc(50% + 35px)',
                    transform: 'translateY(-50%)',
                    background: `${activeMood.color}cc`,
                    color: '#000',
                    padding: '14px 5px',
                    borderRadius: '10px 0 0 10px',
                    cursor: 'pointer',
                    zIndex: 1001,
                    transition: 'right 0.3s cubic-bezier(0.16, 1, 0.3, 1), background 1.5s ease',
                    writingMode: 'vertical-rl',
                    fontSize: '10px',
                    letterSpacing: '2px',
                    fontFamily: 'JetBrains Mono, monospace',
                    fontWeight: 'bold',
                    userSelect: 'none',
                    boxShadow: `0 0 15px ${activeMood.color}66`
                }}
            >
                {sidebarVisible ? '▶ LYRICS' : '◀ LYRICS'}
            </div>

            {/* Lyrics sidebar panel */}
            <div
                ref={sidebarRef}
                className={`lyrics-sidebar glass-panel ${sidebarVisible ? 'visible' : ''}`}
                onMouseEnter={handleSidebarMouseEnter}
                onMouseLeave={handleSidebarMouseLeave}
                style={{ border: `1px solid ${activeMood.color}33`, top: '70px', height: 'calc(100vh - 70px)' }}
            >
                <div style={{ padding: '20px 20px 10px', borderBottom: `1px solid ${activeMood.color}22` }}>
                    <h3 style={{ margin: 0, color: activeMood.color, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' }}>♫ Lyrics</h3>
                    {trackInfo && (
                        <div style={{ marginTop: 10 }}>
                            <div style={{ fontSize: 14, color: '#fff', fontWeight: 'bold' }}>{trackInfo.name}</div>
                            <div style={{ fontSize: 12, color: activeMood.color, opacity: 0.8, marginTop: 2 }}>{trackInfo.artist}</div>
                        </div>
                    )}
                </div>
                <div ref={lyricsContainerRef} style={{ flex: 1, overflowY: 'auto', padding: '10px 20px 20px' }}>
                    {lyricsLoading ? (
                        <div style={{ textAlign: 'center', marginTop: 40, color: activeMood.color }}>Synthesizing lyrics...</div>
                    ) : parsedLyrics.length > 0 ? (
                        parsedLyrics.map((line, idx) => {
                            const isActive = idx === activeLineIndex;
                            const isPast = idx < activeLineIndex;
                            return (
                                <div
                                    key={idx}
                                    ref={isActive ? activeLineRef : null}
                                    className={`lyric-line ${isActive ? 'active' : ''}`}
                                    style={{
                                        color: isActive ? activeMood.color : isPast ? '#6b7280' : '#d1d5db',
                                        fontSize: isActive ? '17px' : '14px',
                                        fontWeight: isActive ? 'bold' : 'normal',
                                        '--active-color': activeMood.color
                                    }}
                                >{line.text}</div>
                            );
                        })
                    ) : (
                        <div style={{ textAlign: 'center', marginTop: 50, color: '#6b7280' }}>
                            <div style={{ fontSize: 36, marginBottom: 10 }}>🎶</div>
                            No vocal sync data available
                        </div>
                    )}
                </div>
            </div>

            {/* ── Inline styles for new components ── */}
            <style>{`
                /* Main content centering */
                .main-content {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 18px;
                    padding: 80px 20px 20px;
                    box-sizing: border-box;
                }

                /* Orb */
                .orb-container { position: relative; width: 220px; height: 220px; display: flex; align-items: center; justify-content: center; }
                .ring { position: absolute; border: 3px solid transparent; border-radius: 50%; border-top-color: inherit; transition: border-color 1.5s ease; pointer-events: none; }
                .ring-outer { width: 200px; height: 200px; animation: spin 8s linear infinite; }
                .ring-mid { width: 168px; height: 168px; animation: spin-rev 5s linear infinite; }
                .ring-inner { width: 136px; height: 136px; animation: spin 12s linear infinite; }
                .orbit-dot { position: absolute; width: 6px; height: 6px; border-radius: 50%; transition: background 1.5s, box-shadow 1.5s; }
                .dot-1 { top: 10px; left: 50%; }
                .dot-2 { top: 84px; left: 0px; }
                .dot-3 { bottom: 10px; right: 50%; }
                .core { width: 100px; height: 100px; border: 2px solid transparent; border-radius: 50%; display: flex; align-items: center; justify-content: center; position: relative; z-index: 10; transition: border-color 0.5s ease, box-shadow 0.5s; background-color: #030712; }
                .core h1 { font-family: 'Instrument Serif', serif; font-size: 44px; margin: 0; transition: color 1.5s ease, text-shadow 1.5s ease; }
                .listening .ring-outer { animation-duration: 3s; }
                .listening .ring-mid { animation-duration: 2s; }
                .listening .ring-inner { animation-duration: 4s; }
                .passive .ring { opacity: 0.2 !important; }
                .passive .core { opacity: 0.6; }
                .speaking .core { animation: core-pulse 0.4s infinite alternate; }
                .playing .orbit-dot { transform: scale(1.5); }
                .playing .ring { animation-timing-function: ease-in-out; }
                .mic-dot.listening { animation: mic-pulse 1.5s infinite; }
                
                /* Ripples */
                .ripple-container { position: absolute; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; z-index: 0; pointer-events: none; }
                .ripple { position: absolute; width: 100px; height: 100px; border-radius: 50%; border: 2px solid transparent; opacity: 0; transition: border-color 1.5s; }
                .speaking .r1 { animation: ripple-expand 1.5s 0s infinite; }
                .speaking .r2 { animation: ripple-expand 1.5s 0.75s infinite; }

                /* Lyrics sidebar */
                .lyrics-sidebar {
                    position: fixed;
                    right: 0;
                    top: 70px;
                    height: calc(100vh - 70px);
                    width: 320px;
                    display: flex;
                    flex-direction: column;
                    transform: translateX(100%);
                    transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                    z-index: 1000;
                    border-radius: 0;
                    border-right: none;
                }
                .lyrics-sidebar.visible {
                    transform: translateX(0);
                }

                /* Circle buttons */
                .circle-btn {
                    width: 44px;
                    height: 44px;
                    border-radius: 50%;
                    background: rgba(0, 0, 0, 0.6);
                    border: 1px solid rgba(34, 211, 238, 0.4);
                    color: #22d3ee;
                    font-size: 18px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s;
                    backdrop-filter: blur(10px);
                }
                .circle-btn:hover {
                    background: rgba(34, 211, 238, 0.2) !important;
                    box-shadow: 0 0 15px rgba(34, 211, 238, 0.4);
                }

                @keyframes slide-in-right {
                    from { transform: translateX(120%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }


                /* Floating cards scrollbar */
                .aura-floating-card::-webkit-scrollbar { width: 4px; }
                .aura-floating-card::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }

                /* Animations */
                @keyframes spin { 100% { transform: rotate(360deg); } }
                @keyframes spin-rev { 100% { transform: rotate(-360deg); } }
                @keyframes rip-expand { 0% { width: 100px; height: 100px; opacity: 1; } 100% { width: 350px; height: 350px; opacity: 0; border-width: 1px; } }
                @keyframes mic-pulse { 0% { transform: scale(1); box-shadow: 0 0 5px #10b981; } 50% { transform: scale(1.2); box-shadow: 0 0 15px #10b981; } 100% { transform: scale(1); box-shadow: 0 0 5px #10b981; } }
                @keyframes wave-bounce { 0%, 100% { height: 8px; } 50% { height: 32px; } }
                @keyframes wave-listen { 0%, 100% { height: 12px; } 50% { height: 20px; } }

                /* Audio Visualizer */
                .wave-bar { height: 8px; transition: background 0.5s ease; }
                .wave-bar.speaking { animation: wave-bounce 1s infinite ease-in-out; }
                .wave-bar.listening { animation: wave-listen 1.5s infinite ease-in-out; }

                /* Parallax */
                .parallax-wrapper { position: relative; width: 600px; height: 300px; display: flex; justify-content: center; align-items: center; transform-style: preserve-3d; transition: transform 0.1s ease-out; flex-shrink: 0; }
                .parallax-layer { position: absolute; inset: 0; display: flex; justify-content: center; align-items: center; }

                /* Lyric lines */
                .lyric-line { transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); padding: 8px 15px; border-radius: 12px; margin-bottom: 8px; }
                .lyric-line:hover { background: rgba(255,255,255,0.03); }
                .lyric-line.active { background: rgba(255,255,255,0.08); transform: scale(1.02); text-shadow: 0 0 10px var(--active-color); }
            `}</style>
        </div>
    );
};

window.AuraUI = AuraUI;
