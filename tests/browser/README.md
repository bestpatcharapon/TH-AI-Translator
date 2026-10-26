# Browser regression checks

`runtime-contract.cjs` sends real same-language requests for all six Style menu
values. It consumes no AI quota and catches stale Flask processes that serve the
updated menu but still reject Standard or Business. Restart Flask after backend
changes if this check reports an unsupported style.

`semantic-review.cjs` checks that ambiguous text stays editable and is not sent or
saved as a chat turn, corrected wording reaches the conversation, and a failed
meaning review preserves the primary translation and its review metadata without
restoring the removed completion notice or leaking status into another feature.

`voice-quality.cjs` checks real browser recording with fake microphone input: audio
capture settings, automatic send by default, optional transcript review, editing, uncertainty even with
automatic send enabled, independent preferences, and rejection of a silent audio
stream before an API request. Speech/translation responses are mocked here; real
provider examples are recorded separately in `reports/voice-quality-synthetic.json`.

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

The Thai interpretation check covers ambiguity blocking, explicit clarification, the real
local dictionary validator, persistence, independent Text/Live Chat settings, unsent
uncertain messages, late results, microphone transcript review and responsive Thai labels.
Translation/transcription are mocked and no AI quota is consumed.

The performance check verifies primary text/chat/photo output before slow additional
languages, canceled background pronunciation, typing debounce, explicit cache bypass,
pause/retry behavior and late-result ownership. All model calls are mocked.

The image formats check verifies HEIC server-preview use, successful image rendering,
and canceled conversion after a feature switch. Preview and translation responses are
mocked here; Python codec tests encode and decode real HEIF bytes without AI calls.

The image formats suite also checks unchanged-result feedback and mixed Thai/English
menus: translated Thai labels appear while existing English labels remain untouched.

Image quality checks also cover the visible target-language picker, readable translation
list, per-label dialog, partial-result warning, and disabled actions for unclear labels.

The numeric preservation suite supplies original pixels spelling 50 with a deliberately
wrong OCR value of 5. It compares every protected pixel on screen and in the downloaded
PNG, while also verifying that translations outside those areas are still rendered.
