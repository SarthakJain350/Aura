/*
 * Onboarding.jsx
 * ACADEMIC DEFINITION: Cold Start Problem
 * The "Cold Start Problem" occurs when a recommendation engine encounters a brand new user and lacks the baseline 
 * historical data required to infer preferences. AURA solves this deterministically.
 */

const Onboarding = ({ onComplete, onReturningComplete, spotifyUser, onSpotifyLogin, onSpotifyLogout, justAuthed, profile: existingProfile }) => {
    const [stage, setStage] = React.useState(0);
    const [profile, setProfile] = React.useState({ ...(existingProfile || window.ProfileService.getProfile()), onboarded: false });
    const [dayInput, setDayInput] = React.useState("");
    const [isConnecting, setIsConnecting] = React.useState(false);
    
    const contexts = ["study", "workout", "sleep", "chill"];
    const genres = ["pop", "lo-fi", "rock", "classical", "hip-hop"];

    const speak = (text) => {
        try {
            const u = new SpeechSynthesisUtterance(text);
            u.rate = 1.1;
            window.speechSynthesis.speak(u);
        } catch (e) {}
    };

    React.useEffect(() => {
        if (justAuthed && spotifyUser) {
            handleContinueExistingUser(); 
        }
    }, [justAuthed, spotifyUser]);

    const handleConnect = () => {
        setIsConnecting(true);
        onSpotifyLogin(); 
    };

    const handleContinueExistingUser = () => {
        window.ProfileService.setActiveId(spotifyUser.id);
        const p = window.ProfileService.getProfile();
        
        if (p.onboarded && !justAuthed) {
            if (onReturningComplete) onReturningComplete(p);
            else onComplete(p);
        } else {
            setProfile({ ...p, onboarded: false });
            setStage(1);
            if (!justAuthed) speak(`Hi ${spotifyUser.display_name}. Let's set up your AURA.`);
            else speak("Authentication successful. Let's set up your profile.");
        }
    };

    const [isSaving, setIsSaving] = React.useState(false);
    const [errors, setErrors] = React.useState({});

    const handleSave = () => {
        console.log("[Onboarding] Initialize Core button clicked!");
        
        const newErrors = {};
        const activeName = profile.name || spotifyUser?.display_name || '';
        
        if (!activeName.toString().trim()) newErrors.name = "Cannot be empty.";
        if (!profile.listening_context) newErrors.context = "Select one.";
        if (!profile.preferred_genre) newErrors.genre = "Select one.";
        if (!dayInput.trim()) newErrors.day = "Cannot be empty.";
        
        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }
        
        setErrors({});
        setIsSaving(true);
        console.log("[Onboarding] Fields validated correctly. Detecting mood...");
        
        try {
            const detected = window.MoodDetector ? window.MoodDetector.detect(dayInput) : { mood: "calm", method: "default", confidence: "LOW" };
            const p = { 
                ...profile, 
                name: activeName,
                default_mood: detected.mood,
                initial_detection_method: detected.method, 
                onboarded: true 
            };
            
            console.log("[Onboarding] Proceeding to save to localStorage:", p);
            const saved = window.ProfileService.saveProfile(p);
            
            if (!saved) {
                console.error("[Onboarding] Storage Helper returned false.");
                setErrors({ 
                    system: "Storage Error: AURA must be run via `python start.py`. Local storage is disabled for direct file:// access.", 
                    corrupt: true 
                });
                setIsSaving(false);
                return;
            }

            if (window.ProfileService.recordMood) {
                window.ProfileService.recordMood(detected.mood, detected.method);
            }
            
            speak(`Initialising core with a ${detected.mood} protocol.`);
            setTimeout(() => {
                setIsSaving(false);
                onComplete(p);
            }, 1000); // Transitions handling handles 1.5s explicitly!
        } catch (err) {
            console.error("[Onboarding] Critical Onboarding Error:", err);
            setErrors({ system: `Exception: ${err.message || 'Unknown error during initialization'}` });
            setIsSaving(false);
        }
    };

    return (
        <div className="login-container-root" style={{ height: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', color: '#f0f0e8', fontFamily: "'Inter', sans-serif", position: 'absolute', top: 0, left: 0, overflow: 'hidden' }}>
            <div className="noise-overlay"></div>
            <div className="grid-overlay"></div>
            <div className="ambient-glow"></div>

            <div className="login-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                    <div className="logo"></div>
                    {spotifyUser && spotifyUser.images && spotifyUser.images[0] && stage === 0 && (
                        <img src={spotifyUser.images[0].url} alt="Profile" style={{ width: 44, height: 44, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.2)' }} />
                    )}
                </div>
                
                {stage === 0 ? (
                    <React.Fragment>
                        <h1>{spotifyUser && !justAuthed ? "Welcome" : "Sign"} <span className="gradient-text">{spotifyUser && !justAuthed ? "back." : "in."}</span></h1>
                        <p className="tagline">System Access Node // 0x4B2A</p>

                        {!spotifyUser ? (
                            <button className="btn-primary" onClick={handleConnect} disabled={isConnecting}>
                                {isConnecting ? (
                                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                                        <div style={{ width: 16, height: 16, border: '2px solid #0a0a0f', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                                        Authenticating...
                                    </span>
                                ) : "Authenticate SDK"}
                            </button>
                        ) : (
                            <React.Fragment>
                                <button className="btn-primary" onClick={handleContinueExistingUser}>
                                    Wake AURA ({spotifyUser.display_name})
                                </button>
                                <div className="links-container">
                                    <a href="#" onClick={(e) => { e.preventDefault(); onSpotifyLogout(); }}>Sign in with a different account</a>
                                </div>
                            </React.Fragment>
                        )}
                    </React.Fragment>
                ) : (
                    <React.Fragment>
                        <h1 style={{ fontSize: '2.5rem' }}>Profile <span className="gradient-text">setup.</span></h1>
                        <p className="tagline" style={{ marginBottom: '1.5rem' }}>AURA Personalization Matrix</p>

                        <div className="form-group">
                            <label>1. Designation Alias {errors.name && <span style={{color: '#ef4444', marginLeft: 10, fontSize: 11, fontStyle: 'italic'}}>{errors.name}</span>}</label>
                            <input type="text" value={profile.name ?? spotifyUser?.display_name ?? ''} onChange={(e) => { setProfile({...profile, name: e.target.value}); setErrors({...errors, name: null}); }} placeholder="Your Name" />
                        </div>

                        <div className="form-group">
                            <label>2. Primary Context {errors.context && <span style={{color: '#ef4444', marginLeft: 10, fontSize: 11, fontStyle: 'italic'}}>{errors.context}</span>}</label>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {contexts.map(ctx => (
                                    <button key={ctx} onClick={() => { setProfile({...profile, listening_context: ctx}); setErrors({...errors, context: null}); }} className={`pill-btn ${profile.listening_context === ctx ? 'active' : ''}`}>
                                        {ctx}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="form-group">
                            <label>3. Optimal Genre Matrix {errors.genre && <span style={{color: '#ef4444', marginLeft: 10, fontSize: 11, fontStyle: 'italic'}}>{errors.genre}</span>}</label>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                {genres.map(g => (
                                    <button key={g} onClick={() => { setProfile({...profile, preferred_genre: g}); setErrors({...errors, genre: null}); }} className={`pill-btn ${profile.preferred_genre === g ? 'active' : ''}`}>
                                        {g}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="form-group">
                            <label>4. Heuristic Polarity {errors.day && <span style={{color: '#ef4444', marginLeft: 10, fontSize: 11, fontStyle: 'italic'}}>{errors.day}</span>}</label>
                            <input type="text" value={dayInput} onChange={(e) => { setDayInput(e.target.value); setErrors({...errors, day: null}); }} placeholder="Describe your day in one sentence..." />
                        </div>

                        {errors.system && (
                            <div style={{color: '#ef4444', marginBottom: '1rem', fontWeight: 'bold', fontSize: 13, textAlign: 'center'}}>
                                {errors.system}
                                {errors.corrupt && (
                                    <button onClick={() => { localStorage.clear(); setErrors({system: "Storage cleared. Try again."}); }} style={{display: 'block', margin: '10px auto', background: '#ef4444', color: '#030712', border: 'none', padding: '6px 14px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold'}}>
                                        Clear Corrupt LocalStorage Data
                                    </button>
                                )}
                            </div>
                        )}

                        <button className="btn-primary" onClick={handleSave} disabled={isSaving} style={{ opacity: isSaving ? 0.7 : 1, marginTop: '2.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10 }}>
                            {isSaving ? (
                                <React.Fragment>
                                    <div style={{ width: 14, height: 14, border: '2px solid #0a0a0f', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                                    Initializing Core...
                                </React.Fragment>
                            ) : "Initialize Core"}
                        </button>
                    </React.Fragment>
                )}
            </div>

            <style>{`
                .login-container-root {
                    --bg-color: #0a0a0f;
                    --fg-color: #f0f0e8;
                    --card-bg: #161620;
                    --border-color: #2a2a35;
                    --muted-text: #8c8c9a;
                    --accent-gradient: linear-gradient(135deg, #eca8d6, #a78bfa, #67e8f9, #fbbf24);
                    --font-display: 'Instrument Serif', Georgia, serif;
                    --font-body: 'Inter', sans-serif;
                    --font-mono: 'JetBrains Mono', monospace;
                }

                .noise-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 10; opacity: 0.03; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E"); }
                
                .grid-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; background-image: linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px); background-size: 50px 50px; background-position: center; }

                .ambient-glow { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 60vh; height: 60vh; background: var(--accent-gradient); filter: blur(120px); opacity: 0.15; border-radius: 50%; z-index: 0; animation: pulse-glow 8s infinite alternate ease-in-out; }

                @keyframes pulse-glow { 0% { transform: translate(-50%, -50%) scale(1); opacity: 0.1; } 100% { transform: translate(-50%, -50%) scale(1.1); opacity: 0.2; } }
                @keyframes blur-reveal { 0% { opacity: 0; filter: blur(20px); transform: translateY(20px) scale(0.98); } 100% { opacity: 1; filter: blur(0px); transform: translateY(0) scale(1); } }
                @keyframes spin { 100% { transform: rotate(360deg); } }

                .login-card { position: relative; z-index: 20; background: rgba(22, 22, 32, 0.85); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 4px; padding: 3.5rem; width: 90%; max-width: 440px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); animation: blur-reveal 1.2s cubic-bezier(0.16, 1, 0.3, 1) forwards; max-height: 90vh; overflow-y: auto; }
                
                .login-card::-webkit-scrollbar { width: 6px; }
                .login-card::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 3px; }

                .login-card::after { content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(to bottom, rgba(0,0,0,0.7), rgba(0,0,0,0.3) 50%, transparent); pointer-events: none; border-radius: 3px; z-index: -1; }

                .logo { display: block; width: 32px; height: 32px; background: var(--accent-gradient); border-radius: 2px; box-shadow: 0 0 15px rgba(167, 139, 250, 0.5); }

                .login-container-root h1 { font-family: var(--font-display); font-size: 3.5rem; font-weight: normal; line-height: 0.92; letter-spacing: -0.02em; margin-top: 0; margin-bottom: 0.75rem; color: var(--fg-color); }
                
                .tagline { font-family: var(--font-mono); font-size: 0.75rem; color: var(--muted-text); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2.5rem; }

                .form-group { margin-bottom: 1.5rem; position: relative; }
                .form-group label { display: block; font-family: var(--font-body); font-size: 0.8rem; font-weight: 500; color: var(--muted-text); margin-bottom: 0.5rem; transition: color 0.3s; }
                .login-container-root input { width: 100%; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 4px; padding: 0.875rem 1rem; color: var(--fg-color); font-family: var(--font-body); font-size: 1rem; outline: none; transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
                .login-container-root input::placeholder { color: var(--muted-text); opacity: 0.5; }
                .login-container-root input:focus { border-color: rgba(255, 255, 255, 0.7); box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.7); }
                .form-group:focus-within label { color: var(--fg-color); }

                .pill-btn { padding: 8px 16px; border-radius: 20px; border: 1px solid var(--border-color); background: var(--card-bg); color: var(--muted-text); font-family: var(--font-body); font-size: 0.8rem; cursor: pointer; transition: all 0.3s ease; text-transform: capitalize; }
                .pill-btn:hover { border-color: var(--muted-text); color: var(--fg-color); }
                .pill-btn.active { background: var(--fg-color); color: var(--bg-color); border-color: var(--fg-color); font-weight: 600; }

                .btn-primary { display: block; width: 100%; background-color: var(--fg-color); color: var(--bg-color); font-family: var(--font-body); font-weight: 600; font-size: 0.95rem; padding: 0.875rem; border: none; border-radius: 4px; cursor: pointer; margin-top: 2rem; transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.4s ease; }
                .btn-primary:hover:not(:disabled) { transform: translateY(-4px); box-shadow: 0 10px 20px -10px rgba(240, 240, 232, 0.3); }
                .btn-primary:disabled { cursor: not-allowed; opacity: 0.8; }

                .links-container { display: flex; justify-content: space-between; margin-top: 1.5rem; font-size: 0.8rem; }
                .login-container-root a { color: var(--muted-text); text-decoration: none; transition: opacity 0.3s ease, color 0.3s ease; opacity: 0.7; }
                .login-container-root a:hover { opacity: 1; color: var(--fg-color); }
                
                .gradient-text { background: var(--accent-gradient); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; background-size: 200% auto; animation: gradient-move 5s linear infinite; }
                @keyframes gradient-move { to { background-position: 200% center; } }
                
                /* Mobile formatting */
                @media (max-width: 480px) {
                    .login-card { padding: 2rem; width: 95%; max-height: 95vh; }
                    .login-container-root h1 { font-size: 2.8rem; }
                }
            `}</style>
        </div>
    );
};

window.Onboarding = Onboarding;
