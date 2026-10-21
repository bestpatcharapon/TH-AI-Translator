# Browser regression checks

Run the Flask app first (`.venv/bin/python app.py`). The isolation check mocks AI,
file extraction, photo translation and audio endpoints; it does not consume API quota.
It verifies independent drafts, languages, tones, results, files, assistant/reply state,
saved records and chat history. It also simulates responses that arrive after aborting,
including transcription, speech and clipboard/IME completion, and checks that entering a
feature does not start background requests. Fake microphone input needs no hardware.

Install the development tools and Chromium, then run from the repository:

```sh
npm ci
npx playwright install chromium
npm run test:browser
```

Chromium requires the usual OS browser libraries. To use a different running server,
set `TRANSLATOR_TEST_URL` (default `http://127.0.0.1:5000`).

The menu check covers preference payloads, at most three additional languages, partial
failures and retry, automatic history/favorites/search/copy, per-feature clearing and
persistence, image and live-chat menus, Thai labels and narrow-screen layout.

The Studio check uses the real local glossary validation/consistency-check endpoints
and mocks AI output. It verifies local terminology persistence, explicit analysis,
grounded evidence and alternatives, audited apply/undo, A/B comparison and JSON export,
feature restoration, late response isolation and analysis size limits.

The practical check covers everyday scenario payloads and localized help, the latest
six complete Live Chat messages, language-pair filtering, context clearing and isolation
from other features. All checks default to port 5000; set TRANSLATOR_TEST_URL as needed.

The cleanup regression check verifies auto-detected language swapping, refreshed audits
when applying suggested revisions, ownership of delayed clipboard feedback and canceled
photo exports after switching features.
