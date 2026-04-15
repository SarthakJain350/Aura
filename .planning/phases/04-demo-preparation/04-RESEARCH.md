# Phase 4: Demo Preparation - Research

## Objective
Research how to implement the remaining Phase 4 tasks: Mic Toggle Button, Do Not Disturb Mode, and Smart Popup Notification System. This research will guide the planner in creating detailed, safe, and verifiable plans.

## Findings

### Priority 2: Mic Toggle Button
- **State Management**: Requires a new state variable `isMicMuted` in `App.jsx`. 
- **Persistence**: Needs to save to and load from `localStorage` on initialization.
- **Speech Interception**: When `isMicMuted` is true, `App.jsx`'s `handleSpeechText` or `handleSpeechCommand` should return early and not process any input, OR `SpeechService.js` should pause the recognition loop. The text-input equivalent commands ("mute", "unmute") need to be added to `handleTextInput`.
- **UI Element**: Needs a new button in `AuraUI.jsx`'s top bar (next to the existing mic active indicator). It should pulse green when active, red static when muted.

### Priority 3: Do Not Disturb (DND) Mode
- **State Management**: Requires a new state variable `isDND` in `App.jsx`.
- **Behavior Changes**:
  - `App.jsx` relies on `say(...)` or `SpeechService.speak(...)` to respond. If `isDND` is true, these voice output functions must return early to enforce silence.
  - Commands still execute (e.g. music changes, genre switches) but without voice confirmation. 
  - Toasts and empathy popups must be suppressed if `isDND` is true.
  - The command log should still update silently.
- **Triggers**: Voice commands ("do not disturb", "silence", "quiet mode") and text inputs needs to toggle `isDND`. 
- **UI Indicator**: A moon icon 🌙 should render in the top bar when active.

### Priority 4: Smart Popup Notification System
- **Event Tracking**: Requires new refs in `App.jsx` to track session history:
  - `focusStartTimeRef` / `moodStartTimeRef` (to track how long a user has been in a specific mood).
  - `genreStartTimeRef` (to track genre duration).
  - `skipCountRef` and `lastSkipTimeRef` (to track skips over a rolling 10-minute window).
  - `lastVoiceCommandTimeRef` (to track inactivity).
- **Notification Component**: Needs a new React component (e.g., `ContextualPopup.jsx` or similar) overlaid on the UI.
  - Should accept a `message` and close automatically after 8 seconds.
  - Needs 'Yes'/'No'/'Dismiss' actions based on the popup.
- **Evaluation Loop**: A `useEffect` with a `setInterval` (e.g. running every 60 seconds) should evaluate conditions (time of day, mood durations) and trigger popups.
- **Constraints**: 
  - Never show a popup if `isDND` is true.
  - Never show the same popup twice per session (requires a `shownPopupsRef` Set).

## Planner Considerations
- The changes are heavily focused on state management in `App.jsx` and some UI modifications in `AuraUI.jsx`. 
- **Avoid God Object anti-pattern**: `App.jsx` is getting large. The notification scheduling logic might be best extracted to a custom hook like `useNotifications.jsx` to keep `App.jsx` clean.
- Ensure all acceptance criteria in the plans strictly verify the logic without subjective tests. State variables should be checked using React Developer Tools or specific DOM attributes (e.g., `<button aria-label="Mic Muted">`).
