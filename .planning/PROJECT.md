# PROJECT: AURA

Aura is an Adaptive Unified Response Assistant focused on providing a seamless, voice-controlled music experience. The system bridges the gap between AI-driven companionship and functional music playback via Spotify.

## Vision
To create a "room-filling" presence that feels alive and responsive, moving beyond simple voice commands to true mood-driven interaction.

## Core Value
**"Elegance through stability."** The user should never have to think about "fixing" AURA; it should just respond.

## Requirements

### Validated
- ✓ Spotify Playlist Integration (Mood-based mapping)
- ✓ Basic Web Speech Recognition (Wake word loop)
- ✓ Onboarding and Permission UI
- ✓ Central Orb Visual Concept

### Active (Milestone 1: Stability & Polish)
- [ ] Reliable Wake Word (95% detection)
- [ ] Natural Language Mood Detection (Semantic mapping over keywords)
- [ ] Stable Settings/Profile UI
- [ ] Music Autostart on Application Load
- [ ] No React Crashes during operation

### Out of Scope (Currently)
- [ ] Hardware integration (e.g., Raspberry Pi)
- [ ] Multi-user voice profiles
- [ ] Video analysis / Facial emotion detection (Purged from codebase)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Babel Standalone | Quick prototyping without build steps | Active |
| Web Speech API | Native, no-cost recognition | Active |
| CDM for ML | Browser-based inference with TF.js | Active |

---
*Last updated: 2026-04-14 during GSD initialization*
