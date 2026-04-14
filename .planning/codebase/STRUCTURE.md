# Project Structure

## Directory Layout

```
Aura/
├── .planning/            # GSD planning and context
├── src/                  # React/JS source code
│   ├── components/       # React UI Components
│   │   ├── profile/      # User profile UI
│   │   ├── Onboarding.jsx
│   │   ├── AuraUI.jsx
│   │   └── WaveVisualizer.jsx
│   ├── services/         # Logic & API Services
│   │   ├── AIEngine.js
│   │   ├── MoodDetector.js
│   │   ├── SpeechService.js
│   │   └── SpotifyService.js
│   ├── App.jsx           # Main Container
│   ├── config.js         # Configuration
│   └── secrets.js        # API Secrets (Local)
├── Background/           # Static assets (video/images)
├── music/                # Data/Model files for analysis
├── server.py             # Python HTTP Server
├── start.py              # Application Entry Point
├── train_model.py        # ML Training Script
├── requirements.txt      # Python Dependencies
├── index.html            # Main Entry Point (loads React via CDN)
└── README.md             # Project Overview
```

## Key Files
- `index.html`: Orchestrates the loading of React, TensorFlow, and services via CDN.
- `src/App.jsx`: State management and service initialization.
- `start.py`: Automates server startup and opens the app in Chrome.
- `src/components/AuraUI.jsx`: The core interactive UI.
