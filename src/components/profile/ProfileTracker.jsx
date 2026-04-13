const { useState, useEffect } = React;

const ProfileTracker = ({ profile, onLogout }) => {
    if (!profile) return null;

    const history = profile.mood_history || [];
    const recent = history.slice(-5).reverse();
    
    // Compute dominant mood
    const moodCounts = {};
    history.forEach(item => {
        moodCounts[item.mood] = (moodCounts[item.mood] || 0) + 1;
    });
    const dominantMood = Object.keys(moodCounts).length > 0 
        ? Object.keys(moodCounts).reduce((a, b) => moodCounts[a] > moodCounts[b] ? a : b) 
        : (profile.default_mood || 'calm');

    const syncLevel = Math.min(100, 30 + history.length * 2);

    return (
        <div className="profile-dashboard-glass">
            <div className="profile-header">
                <h4 style={{ color: '#00e5ff', letterSpacing: '2px', fontSize: '10px', textTransform: 'uppercase', marginBottom: 0 }}>Neural Link Established</h4>
                <h2>AURA_SYNC // <span style={{ color: '#fff', textShadow: '0 0 10px #00e5ff' }}>{profile.name}</span></h2>
                <div style={{ marginTop: 10, display: 'flex', gap: 10 }}>
                    <button className="filter-btn" onClick={onLogout}>Sever Connection</button>
                </div>
            </div>

            <div style={{ margin: '25px 0', border: '1px solid rgba(0, 229, 255, 0.2)', padding: '15px', borderRadius: '12px', background: 'rgba(0, 0, 0, 0.3)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, right: 0, width: '100px', height: '100px', background: 'radial-gradient(circle, rgba(0,229,255,0.2) 0%, rgba(0,0,0,0) 70%)', filter: 'blur(20px)' }}></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontSize: '12px', color: '#00e5ff', fontWeight: 'bold', letterSpacing: '1px' }}>SYNCHRONIZATION RATE</span>
                    <span style={{ fontSize: '12px', color: '#fff', fontWeight: 'bold' }}>{syncLevel}%</span>
                </div>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${syncLevel}%`, background: 'linear-gradient(90deg, #8e24aa, #00e5ff)', boxShadow: '0 0 10px #00e5ff', transition: 'width 1.5s cubic-bezier(0.4, 0, 0.2, 1)' }}></div>
                </div>
            </div>

            <div className="profile-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '25px' }}>
                <div className="profile-card stat-card" style={{ borderColor: 'rgba(142, 36, 170, 0.4)' }}>
                    <h3 style={{ color: '#8e24aa' }}>Dominant Resonance</h3>
                    <div className="stat-value" style={{ textShadow: '0 0 10px #8e24aa' }}>{(dominantMood || 'calm').toUpperCase()}</div>
                    <div className="stat-label">Core Frequency</div>
                </div>
                
                <div className="profile-card stat-card" style={{ borderColor: 'rgba(0, 229, 255, 0.4)' }}>
                    <h3 style={{ color: '#00e5ff' }}>Temporal Engagements</h3>
                    <div className="stat-value">{history.length}</div>
                    <div className="stat-label">Cycles Logged</div>
                </div>
            </div>

            <div className="profile-history">
                <h3 style={{ borderBottom: '1px solid rgba(0, 229, 255, 0.2)', paddingBottom: 10, color: '#00e5ff' }}>Connection Ledger</h3>
                <div className="history-list" style={{ marginTop: '15px' }}>
                    {recent.length > 0 ? recent.map((item, i) => (
                        <div key={i} className="history-item" style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 15px', borderRadius: '8px', marginBottom: '8px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div className="history-icon" style={{ backgroundColor: getMoodColor(item.mood || 'calm'), width: '8px', height: '8px', borderRadius: '50%', boxShadow: `0 0 8px ${getMoodColor(item.mood || 'calm')}` }}></div>
                                <span className="history-mood" style={{ color: '#fff', fontSize: '13px' }}>{(item.mood || 'calm').toUpperCase()}</span>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '10px', color: '#9ca3af' }}>{new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>{(item.method || 'unknown').replace('_', ' ')}</div>
                            </div>
                        </div>
                    )) : (
                        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>Awaiting initial synchronization...</p>
                    )}
                </div>
            </div>
        </div>
    );
};

function getMoodColor(mood) {
    const map = { happy: '#00e5ff', sad: '#8e24aa', calm: '#00d2ff', focused: '#4d4dff', energetic: '#ff007f', stressed: '#ff6600', angry: '#ff003c', tired: '#4a00e0' };
    return map[mood] || '#00e5ff';
}

window.ProfileTracker = ProfileTracker;
