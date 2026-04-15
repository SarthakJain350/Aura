// SpotifyService.js

const CLIENT_ID = window.AURA_CONFIG ? window.AURA_CONFIG.SPOTIFY_CLIENT_ID : null;
const REDIRECT_URI = 'http://127.0.0.1:8888/callback';

function generateRandomString(length) {
    let text = '';
    let possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

async function generateCodeChallenge(codeVerifier) {
    const data = new TextEncoder().encode(codeVerifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode.apply(null, [...new Uint8Array(digest)]))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

window.SpotifyService = {
    accessToken: null,
    player: null,
    deviceId: null,

    login: async function() {
        if (!CLIENT_ID || CLIENT_ID.trim() === 'paste_your_id_here') return;
        const codeVerifier = generateRandomString(128);
        localStorage.setItem('code_verifier', codeVerifier);
        const codeChallenge = await generateCodeChallenge(codeVerifier);
        let args = new URLSearchParams({
            response_type: 'code', client_id: CLIENT_ID,
            scope: 'streaming user-read-email user-read-private user-modify-playback-state',
            redirect_uri: REDIRECT_URI, state: generateRandomString(16),
            code_challenge_method: 'S256', code_challenge: codeChallenge
        });
        window.location = 'https://accounts.spotify.com/authorize?' + args;
    },

    handleCallback: async function() {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        if (!code) return { success: false, error: 'No code in URL' };
        
        const body = new URLSearchParams({
            grant_type: 'authorization_code', code: code,
            redirect_uri: REDIRECT_URI, client_id: CLIENT_ID,
            code_verifier: localStorage.getItem('code_verifier')
        });

        try {
            const response = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body
            });
            const data = await response.json();
            if (data.access_token) {
                this.accessToken = data.access_token;
                localStorage.setItem('spotify_access_token', data.access_token);
                if (data.refresh_token) {
                    localStorage.setItem('spotify_refresh_token', data.refresh_token);
                }
                window.location.href = "http://127.0.0.1:8888/";
                return { success: true };
            }
            return { success: false, error: "Auth denied." };
        } catch (e) { return { success: false, error: e.message }; }
    },

    getMe: async function() {
        const token = localStorage.getItem('spotify_access_token');
        if (!token) return null;
        try {
            const response = await fetch('https://api.spotify.com/v1/me', { headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) return null;
            return await response.json();
        } catch(e) { return null; }
    },

    logout: function() {
        if (this.player) { this.player.disconnect(); this.player = null; }
        localStorage.removeItem('spotify_access_token');
        localStorage.removeItem('spotify_refresh_token');
        localStorage.removeItem('code_verifier');
        this.accessToken = null; this.deviceId = null;
    },

    refreshToken: async function() {
        const refreshToken = localStorage.getItem('spotify_refresh_token');
        if (!refreshToken) return { success: false, error: 'No refresh token' };
        
        const body = new URLSearchParams({
            grant_type: 'refresh_token', refresh_token: refreshToken, client_id: CLIENT_ID
        });

        try {
            const response = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body
            });
            const data = await response.json();
            if (data.access_token) {
                this.accessToken = data.access_token;
                localStorage.setItem('spotify_access_token', data.access_token);
                if (data.refresh_token) {
                    localStorage.setItem('spotify_refresh_token', data.refresh_token);
                }
                console.log('[SPOTIFY] Token refreshed successfully in background.');
                return { success: true };
            }
            return { success: false, error: "Refresh denied." };
        } catch (e) { return { success: false, error: e.message }; }
    },

    initPlayer: function(onReady, onStateChange) {
        const token = localStorage.getItem('spotify_access_token');
        if (!token) return;
        const script = document.createElement("script");
        script.src = "https://sdk.scdn.co/spotify-player.js";
        script.async = true;
        document.body.appendChild(script);

        window.onSpotifyWebPlaybackSDKReady = () => {
            const player = new window.Spotify.Player({
                name: 'AURA Web Player', getOAuthToken: cb => { cb(token); }, volume: 0.5
            });
            player.addListener('ready', ({ device_id }) => { this.deviceId = device_id; if (onReady) onReady(); });
            player.addListener('player_state_changed', state => { if (onStateChange) onStateChange(state); });
            player.connect();
            this.player = player;
        };
    },

    getMoodTracks: async function(mood, genre = "", language = "") {
        const token = localStorage.getItem('spotify_access_token');
        const queryParts = [];
        if (language) queryParts.push(language);
        if (genre) queryParts.push(genre);
        if (mood && mood !== 'none') queryParts.push(mood);
        const queryRaw = queryParts.join(" ") || "mix";
        const q = encodeURIComponent(queryRaw);
        
        try {
            const response = await fetch(`https://api.spotify.com/v1/search?q=${q}&type=track&limit=10`, {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            const data = await response.json();
            
            if (data.tracks && data.tracks.items.length > 0) {
                return data.tracks.items.map(t => t.uri);
            }
        } catch(e) {}
        return null;
    },

    playMood: async function(mood, genre = "", language = "") {
        console.log('[SPOTIFY] playMood called with:', mood, language, genre);
        if (!this.deviceId) return;
        const uris = await this.getMoodTracks(mood, genre, language);
        if (!uris || uris.length === 0) return;

        const token = localStorage.getItem('spotify_access_token');
        try {
            await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${this.deviceId}`, {
                method: 'PUT', body: JSON.stringify({ uris: uris }),
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
            });
        } catch (e) {
            console.error('[SPOTIFY] ❌ playMood failed:', e);
            if (e.name === 'NotAllowedError' || String(e).includes('play() failed')) {
                if (window.setStatusText) window.setStatusText('Click anywhere to start music');
            }
        }
    },

    nextSong: async function() {
        if (!this.deviceId) return;
        const token = localStorage.getItem('spotify_access_token');
        await fetch(`https://api.spotify.com/v1/me/player/next?device_id=${this.deviceId}`, {
            method: 'POST', headers: { 'Authorization': `Bearer ${token}` }
        });
    },
    previousSong: async function() {
        if (!this.deviceId) return;
        const token = localStorage.getItem('spotify_access_token');
        await fetch(`https://api.spotify.com/v1/me/player/previous?device_id=${this.deviceId}`, {
            method: 'POST', headers: { 'Authorization': `Bearer ${token}` }
        });
    },
    pause: function() { if (this.player) this.player.pause(); },
    resume: function() { 
        if (this.player) {
            this.player.resume().catch(e => {
                console.error('[SPOTIFY] ❌ player.resume() failed:', e);
                if (window.setStatusText) window.setStatusText('Click anywhere to start music');
            }); 
        }
    },
    setVolume: async function(vol) {
        if (this.player) {
            try { await this.player.setVolume(vol); } catch (e) { console.error('[SPOTIFY] setVolume err:', e); }
        }
    },
    getPosition: async function() {
        if (!this.player) return 0;
        const state = await this.player.getCurrentState();
        return state ? state.position : 0;
    }
};
