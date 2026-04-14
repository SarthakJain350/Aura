# Testing Practices

## Manual Testing
The project currently relies on manual testing. Key verification points include:
- **Wake Word Recognition**: Saying "AURA" and observing the Orb's reaction.
- **Mood Transitions**: Verifying that specific keywords (e.g., "sad", "party") trigger the correct Spotify playlist.
- **Onboarding Flow**: Ensuring the Spotify login and initial preference selection works as expected.

## Known Challenges
- **Voice Loopbacks**: The system sometimes hears its own voice as a command.
- **Continuous Recognition**: Chromium's `SpeechRecognition` timeout necessitates manual tracking of uptime.

## Future Plans
- **UAT (User Acceptance Testing)**: Integrating `/gsd-verify-work` to automate verification checklists.
- **ML Evaluation**: Validating the TensorFlow model accuracy once training datasets are integrated.
