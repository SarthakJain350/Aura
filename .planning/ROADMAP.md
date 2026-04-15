# ROADMAP: Milestone 1 — Core Stability

## Overview
A 4-phase plan to stabilize the voice pipeline, train local ML models, and polish the UI for demonstration.

## Phases

### [x] Phase 0: GSD Initialization
- [x] Map codebase
- [x] Define requirements
- [x] Establish roadmap

### [x] Phase 1: Stability Fixes
Fixing the core pipeline and UI bugs identified in CONCERNS.md.
- **Goals**: Resolve voice pipeline restarts, fix settings buttons, implement autostart.
- **Outcome**: A "rock-solid" foundation for future features.

### [x] Phase 2: ML Model Training
Transitioning from fallback logic to local intelligence.
- **Goals**: Download datasets, execute `train_model.py`, deploy TensorFlow.js model.
- **Outcome**: Local, privacy-first emotion detection.

### [x] Phase 3: Polish
Enhancing the visual and functional "feel" of AURA.
- **Goals**: UI animations, lyrics enhancement, Spotify token refresh logic.
- **Outcome**: A premium-feeling user experience.

### [ ] Phase 4: Demo Preparation
Preparing for final presentation and end-to-end reliability.
- **Goals**: 30-minute stress tests, presentation mode UI, final documentation.
- **Outcome**: Application ready for broad use/demo.
## Phase 4 Tasks


### Priority 2 — Mic Toggle Button 🟡 SECONDARY
- [x] Add a mic toggle button next to the Mic Active indicator
      in the top status bar
- [x] Button toggles mic on and off manually by clicking
- [x] Voice command "mute mic" or "stop listening" toggles mic off
- [x] Voice command "start listening" or "unmute" toggles mic back on
- [x] Text input accepts "mute" and "unmute" as commands
- [x] Visual state: green pulsing when active, red static when muted
- [x] Mic state persists in localStorage so it survives page refresh

### Priority 3 — Do Not Disturb Mode 🟡 SECONDARY
- [x] Add Do Not Disturb button next to mic toggle in top bar
- [x] When DND is ON:
      - AURA still listens passively and detects wake word
      - Music still plays and changes
      - AURA does NOT speak any responses
      - No toast notifications or popup confirmations appear
      - No empathy flow popups
      - Command log still updates silently
- [x] When DND is OFF: full normal behavior resumes
- [x] DND can be toggled by:
      - Clicking the button manually
      - Saying "do not disturb" or "silence" or "quiet mode"
      - Typing "dnd on" or "dnd off" in text input
- [x] Visual indicator: moon icon 🌙 when DND is active

### Priority 4 — Smart Popup Notification System 🟢 NEW FEATURE
- [x] Implement at least 10 contextual popup notifications:

  1. **Morning Greeting** (6am-12pm first open)
     "Good morning [Name]! Ready to start the day with some
     [default_mood] music?"

  2. **Evening Wind Down** (8pm-11pm)
     "It is getting late [Name]. Want something calm to wind down?"

  3. **Study Session Detected** (focused mood active 20+ minutes)
     "You have been in focus mode for 20 minutes. Taking a break
     soon?"

  4. **Negative Mood Check-in** (sad/stressed/angry for 15+ minutes)
     "You have been feeling [mood] for a while. Want me to play
     something to lift your spirits?"

  5. **Genre Rotation Suggestion** (same genre 45+ minutes)
     "You have been listening to [genre] for a while. Want to
     try something different?"

  6. **Weekend Vibe** (Saturday/Sunday detected)
     "It is the weekend! Want to switch to something more
     relaxed or energetic?"

  7. **High Skip Rate** (5+ skips in 10 minutes)
     "You have skipped a lot of songs. Should I try a
     completely different genre?"

  8. **New User Welcome** (first session after onboarding)
     "Welcome to AURA [Name]! Say Aura anytime to control
     your music with your voice."

  9. **Mood Streak** (same positive mood 3+ sessions in a row)
     "You have been in a great mood lately [Name]! Keep it up."

  10. **Inactivity Detected** (no voice command for 30+ minutes)
      "Still there [Name]? Say Aura if you want to change
      anything."

  11. **Late Night** (12am-4am)
      "You are up late [Name]. Want something calm or are you
      still going strong?"

  12. **Monday Motivation** (Monday morning detected)
      "Monday again [Name]. Let me play something to help
      you start the week right."

- [x] Each popup must:
      - Show for maximum 8 seconds then auto-dismiss
      - Have Yes and No or Dismiss buttons
      - Never show the same popup twice in one session
      - Respect Do Not Disturb mode — never show when DND is on
      - Log in command log when dismissed

---

## Phase 4 Success Criteria

- [x] Mic toggle button visible and working in top bar
- [x] DND button visible and working in top bar
- [x] At least 10 contextual popups implemented and tested
- [x] No React crashes in a 30 minute live session
- [x] Full demo script runs end to end without manual intervention

---

## Demo Script for Phase 4 Verification

1. [x] Open AURA → confirm morning/evening greeting popup appears
2. [x] Say "Aura" → confirm orb glows and AURA says yes I am listening
3. [x] Say "I am feeling happy" → confirm happy mood and music
4. [x] Say "Aura pause" → confirm music pauses, mood does NOT change
5. [x] Say "Aura next" → confirm track skips, mood does NOT change
6. [x] Say "Aura play rock" → confirm genre changes to rock
7. [x] Click mic toggle → confirm mic turns off and indicator turns red
8. [x] Click DND button → confirm moon icon appears
9. [x] Say something → confirm AURA is silent but still listens
10. [x] Skip 3 songs → confirm genre rotation toast appears
11. [x] Wait 30 minutes → confirm inactivity popup appears
12. [x] Check profile panel → confirm mood history is updating

---

## Known Remaining Concerns

- TensorFlow ML model not yet trained — running on keyword
  and sentiment fallback
- Lyrics API occasionally fails for Hindi and Korean tracks
  (dual fallback now implemented)
- Gemini API daily rate limits may cause AI offline mode
  during heavy demo testing

---

## Notes
- Use free credits only — stop at 50% usage(only when allowed to use credits)
- Do not purchase additional credits
- Stop current task if credit limit reached and document
  progress clearly before stopping
- Phase 4 target completion
---
*Last updated: 2026-04-14*
