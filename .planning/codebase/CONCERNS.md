# Technical Concerns & Debt

## Core Stability Issues
- **Stale Closure Bug**: The voice handler can lose synchronization with the React state after extended use, leading to "stale" data being used in handlers.
- **Web Speech API Instability**: Recognition sometimes stops in Chrome after 10-15 minutes of continuous use, requiring a robust restart loop.
- **Spotify Token Expiry**: Access tokens expire after 1 hour. The current refresh flow is incomplete, often requiring a manual re-login.
- **Double Playback Controls**: Duplicate button rows appear because controls are rendered both in the main UI and as children from `App.jsx`.

## Feature & ML Debt
- **TensorFlow ML model not trained**: `train_model.py` exists, but datasets have not been downloaded. Aura currently relies on keyword and sentiment fallback logic.
- **WaveVisualizer removed**: The canvas wave animation was removed due to syntax errors. It needs to be properly reimplemented to provide visual feedback during speech.

## Integration & Environment
- **CORS and MIME sensitivity**: The Python `http.server` occasionally serves `.jsx` files with the wrong content type, causing browser errors on some systems.
- **Lyrics API reliability**: `lrclib.net` occasionally returns no results, specifically for Indian and Korean music.
- **Gemini API quota**: Gemini 1.5 Flash has daily rate limits that can cause "AI Offline" mode during heavy testing or use.

## UX/UI Debt
- **No Token Refresh**: User must manually log out and back in when the Spotify token expires.
- **Microphone Status**: Need a clearer real-time indicator of whether AURA is listening.
