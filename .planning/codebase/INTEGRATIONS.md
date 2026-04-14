# External Integrations

## API Services
- **Spotify Web API**: Used for music playback, search, and mood-based recommendations (`SpotifyService.js`).
- **OpenAI / Google Gemini**: Integrated via `AIEngine.js` for processing natural language commands and fallback mood detection.
- **lrclib.net**: External API for fetching song lyrics.

## Browser APIs
- **Web Speech API**:
  - `SpeechRecognition`: Used for the wake word "AURA" and manual voice commands.
  - `SpeechSynthesis`: Used for AURA's vocal responses.
- **WebSocket**: Used for real-time communication between the Python backend and the React frontend (likely for sensor data or terminal logging).

## Local Systems
- **Python Backend**: Runs at `http://127.0.0.1:8888`.
- **Local Model**: TensorFlow model for emotion/mood detection (trained via `train_model.py`, though currently pending data download).
