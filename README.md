# AURA - Adaptive Unified Response Assistant

AURA is a voice-controlled music assistant that uses AI to detect your mood and play appropriate music via Spotify.

## Features

- **Mood Detection**: Built-in AI to analyze voice patterns and detect mood.
- **Voice Commands**: Control Spotify playback using voice.
- **Dynamic UI**: Fluid, orb-based interface using React and CSS animations.
- **Spotify Integration**: seamless playback control and mood-based playlist selection.

## Setup

### Prerequisites

- Python 3.x
- A modern web browser (Chrome recommended)
- A Spotify Premium account (for playback control)
- A Gemini API Key (for the AI engine)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/Aura.git
   ```
2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Configure API Keys:
   - Create a file `src/secrets.js` in the `src` directory.
   - Add your keys in the following format:
     ```javascript
     window.AURA_SECRETS = {
         SPOTIFY_CLIENT_ID: "YOUR_SPOTIFY_CLIENT_ID",
         GEMINI_API_KEY: "YOUR_GEMINI_API_KEY"
     };
     ```

### Running AURA

1. Start the local server:
   ```bash
   python start.py
   ```
2. Open your browser and navigate to `http://127.0.0.1:8888`.

## Technology Stack

- **Frontend**: HTML5, Vanilla JavaScript, React (Babel Standalone), Tailwind CSS (CDN).
- **Backend**: Python (HTTP Server).
- **AI**: TensorFlow.js, Gemini API.
- **Music**: Spotify Web API.

## License

MIT
