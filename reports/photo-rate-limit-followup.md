# Photo rate-limit follow-up

The supplied screenshot shows the app's HTTP 429 state. It does not identify the provider or quota dimension. The Retry button is enabled after the countdown expires, so a screenshot without a countdown does not establish that the retry timer is broken.

Read-only production `/api/ocr-status` returned `photo_backend: vision`. A synthetic four-label fixture submitted to the production photo endpoint returned HTTP 200 in 7.47 seconds. This verifies that the deployed OCR path can run; it does not reproduce the user's dense menu or reveal production provider/account settings. Raw result: `photo-production-check.json`.

Found an avoidable request multiplier: the serverless reader sent each five-region crop sheet as a separate AI request. Gemini now accepts up to four unchanged-resolution sheets (20 measured regions) in one request, keeping unique IDs and the same per-region validation. Groq remains at five regions per request; native OCR verification remains at ten. No provider is switched automatically and no billing settings are changed.

A real local simulation of the serverless Gemini path on a generated Thai menu returned HTTP 200 in 13.47 seconds. It detected 34 regions, made two Gemini reading requests (4 and 3 images), then two Groq translation requests. The previous five-region grouping would require seven reading requests for those 34 regions. All 17 expected Thai labels matched the fixture and 17 regions were translated. This is one synthetic example, not a user-photo accuracy or latency guarantee. Raw result: `photo-batched-menu-check.json`.

Regression simulates a later rate-limit failure among 45 regions. It verifies all crop IDs and full-resolution sheet dimensions, then confirms completed batches are reused during retry; calls cover [20,20-failed,20,5]. Provider/type checks pass. Existing native/single-image reading tests retain their behavior.

The change reduces request count, not account quota restrictions. Request/minute, token/minute, daily and billing-tier limits still apply. These two production/local tests do not identify which limit caused the user's earlier failure. No new production deployment was made. Use `PHOTO_READING_PROVIDER=gemini` with `GEMINI_API_KEY` and deploy the new code to use the grouping.

Sources:
- https://ai.google.dev/gemini-api/docs/rate-limits
- https://ai.google.dev/gemini-api/docs/image-understanding
- https://ai.google.dev/gemini-api/docs/openai
- https://console.groq.com/docs/rate-limits
