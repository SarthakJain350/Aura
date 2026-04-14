# Technology Stack

## Core Technologies
- **Frontend**: React 18 (production build via unpkg CDN)
- **JSX Transformation**: Babel Standalone (browser-based transpilations)
- **Backend / Dev Server**: Python 3 (`start.py`, `server.py`)
- **Web App Server**: Python `http.server` (customized in `server.py`)

## CSS & Styling
- **Type**: Vanilla CSS (`AuraUI.css`)
- **Fonts**: Google Fonts (Instrument Serif, Inter, JetBrains Mono)
- **Aesthetics**: Dark mode, vibrant glow effects, glassmorphism.

## Machine Learning & AI
- **Browser-side**: TensorFlow.js (4.10.0)
- **Server-side**: TensorFlow (2.10.0+), Scikit-learn, Pandas, NumPy
- **LLM Engine**: Gemini 1.5 Flash (via AIEngine)

## Key Libraries & Tools
- **Spotify**: Spotify Web API (via `SpotifyService.js`)
- **Web Speech**: Native Browser Web Speech API (Recognition & Synthesis)

## Configuration & Environment
- **secrets.js**: Likely contains API keys (Spotify, OpenAI, lrclib)
- **config.js**: Project-wide constants and configurations
