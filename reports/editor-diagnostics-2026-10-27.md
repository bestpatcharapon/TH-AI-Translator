# Editor diagnostics — 2026-10-27

Checked the installed Zed BasedPyright 1.40.2, TypeScript language service and VS Code CSS language service. The screenshot supplies counters, not individual diagnostics; the workspace CLI checks inspect all Python source/test files rather than only open editor buffers.

The previous implicit BasedPyright `recommended` profile reported 291 errors and 4,626 warnings across 62 files, mostly missing/unknown annotations and dynamic JSON inference. Set an explicit `standard` profile in pyrightconfig.json for this partially annotated project. All application, script and test files remain checked; only dependency/model/generated directories are excluded. This profile change reduces annotation-related noise and is part of the result; it is not a claim that thousands of strict-profile annotations were added.

Fixed the actionable type contracts: typed reasoning options with validated SDK enum values, translation keyword options, language/voice mappings, structured audit results, validated JSON return shapes, an explicit missing interpretation guard and a definite bytes-or-error speech result. Tests use Flask get_json(), SDK-shaped mocked rate-limit responses, explicit mock imports and a checked RGB pixel shape. Initialized benchmark OCR state before its loop.

Renamed the preference picker's block-local `open` function to `openPreference`, avoiding the DOM window.open declaration collision. Added matching standard line-clamp properties for the prefixed CSS declarations and their reset.

Reproducible type check: npm ci, then npm run typecheck. BasedPyright is pinned in package-lock.json and the editor reads the same project configuration.

Final checks:

- BasedPyright standard: 0 errors, 0 warnings, 0 notes across 62 files.
- TypeScript diagnostics for the shared static scripts under the default JS checking policy: 0.
- CSS language service diagnostics: 0 (previously two vendor-prefix warnings).
- Python unittest: 220 passed, including supported/invalid reasoning levels.
- Ruff lint/format, frontend syntax and Prettier: passed.
- Preference picker browser regression: passed, including keyboard/RTL and narrow layouts. AI responses mocked.

The live editor counter itself is not accessible from this session. An editor with stale/unsaved buffers may need its language server or project reloaded. No production deployment was performed.
