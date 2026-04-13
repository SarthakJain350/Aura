/*
 * ProfileService.js
 * ACADEMIC DEFINITION: Implicit Feedback Learning
 * AURA tracks song completions natively as positive reinforcements (+1 weight) and abrupt song skips 
 * as negative reinforcements (-1 weight). This persistent map natively biases the subsequent searches internally 
 * to organically structure highly personalized queues without relying on formal matrix factorization backends.
 */

const DEFAULT_PROFILE = {
    name: "",
    onboarded: false,
    default_mood: "calm",
    preferred_genre: "mix",
    music_language: "English",
    listening_context: "study",
    initial_detection_method: "default",
    favourites: [],
    song_weights: {},
    skip_count: 0,
    mood_history: [] // Array of { timestamp, mood, detection_method, time_of_day }
};

function safeWrite(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch(e) {
    console.error('Storage failed:', e.name, e.message);
    return false;
  }
}

window.ProfileService = {
    activeSpotifyId: null,
    
    setActiveId: function(id) { 
        this.activeSpotifyId = id; 
    },
    
    getProfile: function() {
        if (!this.activeSpotifyId) return { ...DEFAULT_PROFILE };
        try {
            const raw = localStorage.getItem(`aura_profile_${this.activeSpotifyId}`);
            if (raw) return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
        } catch(e) {}
        return { ...DEFAULT_PROFILE, spotifyId: this.activeSpotifyId };
    },

    saveProfile: function(profile) {
        if (!this.activeSpotifyId) return false;
        return safeWrite(`aura_profile_${this.activeSpotifyId}`, profile);
    },

    recordMood: function(mood, method) {
        const profile = this.getProfile();
        const hr = new Date().getHours();
        let tod = 'night';
        if (hr >= 6 && hr < 12) tod = 'morning';
        else if (hr >= 12 && hr < 18) tod = 'afternoon';
        else if (hr >= 18 && hr < 24) tod = 'evening';
        
        if (!Array.isArray(profile.mood_history)) {
            profile.mood_history = [];
        }
        
        profile.mood_history.push({ timestamp: Date.now(), mood, detection_method: method, time_of_day: tod });
        return this.saveProfile(profile);
    },

    onSkip: function(songId) {
        const profile = this.getProfile();
        const rw = profile.song_weights[songId] || 0;
        profile.song_weights[songId] = rw - 1; // Explicit rule: -1 score for skips
        profile.skip_count += 1;
        this.saveProfile(profile);
        return profile.skip_count;
    },

    onFullListen: function(songId) {
        const profile = this.getProfile();
        const rw = profile.song_weights[songId] || 0;
        const newWeight = rw + 1; // Explicit rule: +1 score for completions
        profile.song_weights[songId] = newWeight;
        
        if (newWeight >= 5 && !profile.favourites.includes(songId)) {
            profile.favourites.push(songId);
        }
        profile.skip_count = 0;
        this.saveProfile(profile);
    },
    
    resetSkipCount: function() {
        const profile = this.getProfile();
        profile.skip_count = 0;
        this.saveProfile(profile);
    },

    getGenreRotation: function() {
        return ['pop', 'lo-fi', 'rock', 'classical', 'hip-hop'];
    },

    clearAll: function() {
        localStorage.clear();
        this.activeSpotifyId = null;
    }
};
