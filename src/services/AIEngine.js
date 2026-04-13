// AIEngine.js
// Powered by Gemini for a Siri-like human conversational experience.

window.AIEngine = {
    chatHistory: [],
    geminiStatus: 'checking',
    
    localFallback: function(text) {
        const lower = text.toLowerCase()
        
        // 1. Explicit playback commands first — these take priority
        if (lower.includes('next') || lower.includes('skip'))
            return { reply: 'Skipping.', action: { type: 'next' } }
        if (lower.includes('pause') || lower.includes('stop'))
            return { reply: 'Pausing.', action: { type: 'pause' } }
        if (lower.includes('resume'))
            return { reply: 'Resuming.', action: { type: 'resume' } }
            
        // 2. Genre commands
        const genres = ['pop','rock','classical','lofi','lo-fi','jazz','hip-hop','electronic']
        for (const genre of genres) {
            if (lower.includes(genre))
                return { reply: `Switching to ${genre}.`, action: { type: 'play_genre', genre } }
        }
        
        // 3. Language commands
        const languages = ['hindi','english','korean','spanish','french','arabic','japanese']
        for (const lang of languages) {
            if (lower.includes(lang))
                return { reply: `Switching to ${lang} songs.`, action: { type: 'play_language', language: lang } }
        }
        
        // 4. Mood detection — runs LAST after all other commands checked
        const moodResult = window.MoodDetector.detect(text)
        if (moodResult.confidence === 'HIGH') {
            return { reply: `Playing ${moodResult.mood} music.`, action: { type: 'play_mood', mood: moodResult.mood } }
        }
        
        // 5. Absolute last resort — do NOT resume, just play calm
        return { reply: 'Playing something for you.', action: { type: 'play_mood', mood: 'calm' } }
    },

    _getSystemPrompt: function(profile) {
        return `
You are Aura, a blunt, highly observant, and extremely human friend. 
You speak conversationally and naturally. You are cynical but caring. 
You MUST limit your response to EXACTLY 1 short sentence. Listen deeply. 
The user is ${profile?.name || "a friend"}. 
If they want a specific genre, language, or mood of music, output it in the JSON action structure.
For example, if they say "play rock", you set action type to "play_genre" and genre to "rock".
Always reply with JSON ONLY. Do not use markdown tags.
{
  "reply": "Your 1 sentence human response here.",
  "action": {
    "type": "none | play_mood | play_genre | pause | resume | next",
    "mood": "happy | sad | calm | focused | energetic | stressed | angry | tired",
    "genre": "pop | rock | classical | hip-hop | lofi | metal | anything",
    "language": "english | hindi | korean | spanish | any"
  }
}
`;
    },

    processCommand: async function(commandText) {
        console.log(`[AIEngine] Processing: "${commandText}"`);
        
        // Fix 4: Try local fallback first on every command
        const fallbackMatch = this.localFallback(commandText);
        if (fallbackMatch && fallbackMatch.reply !== 'Playing something for you.') {
            console.log('[AIEngine] Using local fallback (Primary Match):', fallbackMatch);
            return fallbackMatch;
        }
        
        if (!window.AURA_CONFIG || !window.AURA_CONFIG.GEMINI_API_KEY) {
            console.warn("No Gemini API Key found. Falling back to local keyword parsing.");
            return fallbackMatch;
        }

        const profile = window.ProfileService ? window.ProfileService.getProfile() : {};
        const systemPrompt = this._getSystemPrompt(profile);

        const messages = [
            { role: "user", parts: [{ text: systemPrompt }] },
            { role: "model", parts: [{ text: `{"reply": "I am online and ready.", "action": {"type": "none"}}` }] },
            ...this.chatHistory,
            { role: "user", parts: [{ text: commandText }] }
        ];

        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${window.AURA_CONFIG.GEMINI_API_KEY}`;
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: messages,
                    generationConfig: { temperature: 0.7 }
                })
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.status}`);
            }

            const data = await response.json();
            const rawText = data.candidates[0].content.parts[0].text;
            
            // Clean markdown logic if Gemini happens to inject ```json
            const cleanedText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanedText);

            // Keep context window small
            this.chatHistory.push({ role: "user", parts: [{ text: commandText }] });
            this.chatHistory.push({ role: "model", parts: [{ text: cleanedText }] });
            if (this.chatHistory.length > 10) this.chatHistory = this.chatHistory.slice(-10);

            return parsed;
        } catch(err) {
            console.error('[GEMINI] Full error:', err)
            console.error('[GEMINI] Error name:', err.name)
            console.error('[GEMINI] Error message:', err.message)
            console.error('[GEMINI] Status:', err.status)
            
            // Do NOT return missed that — use fallback instead
            const fallback = window.MoodDetector.detect(commandText)
            console.log('[GEMINI] Using fallback mood:', fallback)
            return {
                reply: `Got it, playing ${fallback.mood} music.`,
                action: { type: 'play_mood', mood: fallback.mood }
            }
        }
    }
};

// Fix 2: Test Gemini API Key is Valid
async function testGemini() {
    if (!window.AURA_CONFIG || !window.AURA_CONFIG.GEMINI_API_KEY) {
        window.AIEngine.geminiStatus = 'orange'; // running in offline mode
        return;
    }
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${window.AURA_CONFIG.GEMINI_API_KEY}`
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: 'say ok' }] }]
            })
        })
        const data = await response.json()
        console.log('[GEMINI TEST] Full response:', data)
        if (data.error) {
            console.error('[GEMINI TEST] API Error:', data.error.message)
            window.AIEngine.geminiStatus = 'red';
        } else {
            window.AIEngine.geminiStatus = 'green';
        }
    } catch (e) {
        console.error('[GEMINI TEST] Catch:', e);
        window.AIEngine.geminiStatus = 'red';
    }
}
setTimeout(testGemini, 2000);
