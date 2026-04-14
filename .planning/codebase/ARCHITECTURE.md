# System Architecture

## Overview
Aura is a voice-controlled music assistant built with a hybrid React/Python architecture. It emphasizes real-time voice interaction and mood-driven music playback.

## Core Layers

### 1. Presentation Layer (React)
- **`App.jsx`**: Main entry point and state orchestrator. Manages overall UI state and coordinate between services.
- **`AuraUI.jsx`**: The primary user interface, featuring the central "Orb" and playback controls.
- **`Onboarding.jsx`**: Handles initial user setup and Spotify authentication.

### 2. Service Layer (Vanilla JS)
Services are singleton-like objects that bridge the UI with hardware/APIs.
- **`SpeechService.js`**: Managed the Web Speech listener and command processing.
- **`MoodDetector.js`**: Analyzes text/speech to determine user sentiment and mood.
- **`SpotifyService.js`**: Interfaces with the Spotify Web SDK/API for playback.
- **`AIEngine.js`**: Logic for fallback command processing and AI responses.

### 3. Backend Layer (Python)
- **`start.py`**: Entry script to launch the server and browser.
- **`server.py`**: Custom HTTP server using Python's `http.server`. Serves the static site and handles JSX mapping.

## Data Flow
1. **Voice Input**: `SpeechService` listens for the wake word "AURA".
2. **Command Recognition**: Once awakened, the transcript is sent to `App.js`.
3. **Intent Detection**: `MoodDetector` and `AIEngine` parse the text for "Moods" or "Playback Commands".
4. **Action**: `SpotifyService` triggers the appropriate playlist or track.
5. **Feedback**: UI updates with glow effects and `WaveVisualizer` (currently disabled) animations.
