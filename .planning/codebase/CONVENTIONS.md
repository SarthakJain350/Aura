# Coding Conventions

## Framework & React Patterns
- **React Components**: Functional components are preferred.
- **State Management**: State is largely managed at the `App.jsx` level and passed down as props to ensure service-level synchronization.
- **JSX**: Transpilation happens in the browser via Babel Standalone. Avoid complex modern syntax that might not be handled by the current Babel config without a build step.

## Service Patterns
- **Services as Objects**: Services (e.g., `SpotifyService`) are defined as object literals or classes with static methods, making them globally accessible after loading.
- **Event Handling**: Heavy reliance on the `window` object to expose handlers (e.g., `window.processCommand`) to the `SpeechService` logic.

## Naming & Style
- **Files**: PascalCase for components (`AuraUI.jsx`), kebab-case or camelCase for services/utils.
- **Variables**: `camelCase` for variables and functions.
- **Styling**: Vanilla CSS in companion `.css` files.

## Error Handling
- **Global Error Boundary**: `index.html` implements a `window.onerror` handler that displays a fallback UI in case of total application failure.
- **Fail-safes**: Services often include fallback logic (e.g., `MoodDetector` falls back to keyword matching if LLM fails).
