# Refactoring Plan - Jackett Integration (IMPLEMENTED)

## Goal
Clean up and modularize the recently added Jackett integration code to improve maintainability and readability.

## User Review Required
None. Internal cleanup.

## Proposed Changes

### 1. `manager.js`
- **Extract Jackett UI Logic:** Create a `JackettController` object (or similar structure) within `manager.js` or a new file to encapsulate:
    - `checkJackettStatus`
    - `saveJackettConfig`
    - `loadJackettTrackers`
    - `executeJackettSearch`
    - `renderJackettResults`
- **Remove Magic Strings:** Define constants for status emojis (⚪, 🟢, 🔴, 🟡) and messages.
- **Simplify `init()`:** Reduce the clutter in the initialization block by delegating to the controller.

### 2. `style.css`
- **Organization:** Move the appended CSS rules for `.status-indicator` and `.disabled-tab` to their appropriate sections (e.g., near Header or Tabs) instead of being at the very bottom.
- **Consolidation:** Ensure no duplicate or conflicting rules.

### 3. `jackett.js`
- **Review:** Ensure `testConnection` and `getCategoryName` are robust. (Already looks good, but a quick check won't hurt).

## Verification Plan
- **Manual Test:** Verify that all features (Status check, Search tab disabling, Config saving, Searching) still work exactly as before after the refactor.
