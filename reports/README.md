# Performance measurements

The updated sentence-level comparison after the accuracy changes is in
[google-comparison-v2/README.md](google-comparison-v2/README.md): 12 regression
cases and 14 new complete sentences, with before/after outputs, Google screenshots,
request failures retained, and remaining meaning/fluency issues disclosed.

The actual Google Translate comparison is in
[google-comparison/README.md](google-comparison/README.md): 12 same-input text cases,
captured Google Advanced website screenshots, the app's raw API results, and explicit
limitations of the assistant's qualitative judgments. Five additional Live Chat
diagnostics are recorded separately from the main text comparison.

`semantic-review-seeded.json` is a small real-provider challenge using deliberately
incorrect drafts, plus one adequate draft. The reviewer corrected the four seeded
errors: reversed allergy/negation, a reversed rain condition, unpaid vs already paid,
and swapped meeting times. The adequate draft remained unchanged. The second pass
took about 1–2 seconds per case in this single run. These results test whether a
reviewer can recover known errors; they do not measure end-to-end accuracy, unseen
language performance, noisy OCR/speech accuracy or performance against Google.
Run `python scripts/benchmark_semantic_review.py --live` to reproduce (API quota).

The application only accepts supported quote evidence and rejects revisions that
introduce new mechanical fact/terminology flags. Those checks cannot prove semantic
correctness; an inaccurate model judgment can still pass. Review is bounded to
3,000-character source text, selected Thai/English risk patterns, selected contexts,
glossary/conversation use and Live Chat. Ambiguous cases ask for context before being
displayed/sent; unavailable review is disclosed and not cached as a checked result.

`voice-quality-synthetic.json` contains real Groq transcriptions of three clean
Edge TTS clips (Thai and English), comparing Whisper Large V3 Turbo with Large V3,
plus live translation outputs. Run
`python scripts/benchmark_voice_quality.py --live` to reproduce (uses API quota).
The full model recognized ถั่วลิสง correctly where Turbo misread it in this sample.
Both models still transcribed จอง as จ้อง in the table-booking clip; high-confidence
segments therefore do not guarantee correct spelling. The translation recovered the
booking intent and preserved 7:30pm and the 150/50 baht contrast. These are inspection
examples, not a measured accuracy rate, human microphone test or Google comparison.

Live Chat now defaults to translating and sending when recording stops; the user can
enable transcript review before sending. Uncertain segment metadata still requires review even when automatic send
is enabled. Capture requests mono audio, echo cancellation, noise suppression and
automatic gain, with 128 kbps recording where the browser supports it. Digital silence
is rejected by the browser meter, and silent PCM WAV uploads are rejected on the
server before calling the provider. Low log probability, likely silence, repetition
or missing evidence are review flags, not calibrated confidence percentages. This is
not a general voice activity detector for noisy recordings. Other uploads still rely
on provider segment evidence and user review. No AI rewrites the original transcript.

`paddle-ocr-synthetic.json` records real Paddle CPU inference on a generated
640×1000 Thai menu with 15px Thai text. Run
`python scripts/benchmark_paddle_ocr.py` to reproduce it without cloud calls.
This sample found all 14 prices as `50 Baht` and matched 16 of 17 Thai labels
exactly; one Thai label was misread. Detection and recognition took 9.915s
including first-use model loading and 6.451s with already-loaded predictors.
These are single measurements on this machine, not latency guarantees.

A separate live Flask `/api/photo-translate` check on another generated Thai menu
returned HTTP 200 in 10.999s with `ocr_engine=paddle`, 17 translated areas and
14 unchanged `50 Baht` prices. Repeating that exact request took 0.0048s because
it reused the complete cached result, not because new OCR became that fast.
The browser displayed all 17 translated labels with no JavaScript errors.
The v6 general recognizer also read `Seafood fried rice`, `50 Baht` and
`Open daily 10:00-20:00` exactly in a separate English smoke test.

These fixtures are synthetic. The user's original menu image was not available
as a local file, and no same-image comparison against Google Lens was performed.
Raw OCR confidence can be high even for an incorrect Thai reading.

`performance-latest.json` records one local before/after sample using the same
configured translation model, plus a synthetic concurrency check. It is not a
statistical performance benchmark or a translation accuracy evaluation.

The baseline was the running process before these performance changes; the optimized
process ran on port 5051. Baseline services were already warm. Provider/network load,
TLS connection warm-up and provider prompt caching were not controlled. In particular,
the first optimized text request was slower than the baseline sample. Repeated-request
cache hits measure reuse, not new AI generation. Photos used a generated English menu
fixture; original OCR labels, numbers and translated labels are recorded for inspection.
The speech/transcription samples used the synthetic sentence “Hello, welcome.”

Run `python scripts/benchmark_performance.py` for the synthetic provider check without
calling AI. `--live --url http://127.0.0.1:5000 --speech` also measures real text, photo,
speech and transcription requests and consumes provider quota. For an actual before/after
comparison, run a separate baseline server and provide `--baseline-url`. Reusing a warm
server may yield cache hits; the report explicitly includes cache status where available.
