# Real photo and speech benchmark

The existing OCR/voice checks use generated images and TTS audio. This kit measures
the app on **real** photos and recordings instead.

## 1. Collect media

Recommended minimum (more is better; vary phones, light, noise and angles):

| Set | Count |
| --- | --- |
| Menus (printed, handwritten, chalkboard) | ~20 photos |
| Signs (street, shop, transport, warnings) | ~20 photos |
| Receipts (thermal, handwritten, e-receipts photographed) | ~20 photos |
| Central Thai speech | ~20 recordings |
| Northern Thai (Kham Mueang) speech | ~20 recordings |
| Isan speech | ~20 recordings |
| Southern Thai speech | ~20 recordings |

- **Get consent** from every speaker and from anyone visible in a photo, and tell them the
  files are sent to the configured cloud OCR/speech provider.
- **Avoid personal data**: crop or skip names, phone numbers, addresses, card numbers, faces
  and licence plates. Do not record private conversations.
- Write `expected_text` by hand from the photo/recording (what a careful human reads or
  hears), not from any app output, otherwise CER is biased.

Put the files anywhere under `data/real-media/` (sub-folders are fine). Media files and
`manifest.json` are git-ignored here; only this README and the example are tracked.

## 2. Write the manifest

Copy `manifest.example.json` to `manifest.json` and add one entry per file:

```json
{"file": "menus/shop-01.jpg", "kind": "image", "language": "th",
 "expected_text": "...", "target": "en", "notes": "night, glare"}
```

- `file`: path relative to the manifest
- `kind`: `image` (runs the app's photo OCR + translation route) or `audio` (runs transcription)
- `language`: catalog code of the text/speech (`th`, `en`, `lo`, `zh`, ...). Dialect speech is
  still `th`; describe the accent in `notes`.
- `target`: translation target for photos (optional; defaults to `en` for Thai, otherwise `th`)

## 3. Run

```sh
.venv/bin/python scripts/benchmark_real_media.py --live
# or: --manifest path/to/manifest.json --out-dir reports/real-media
```

`--live` is required because every file uses OCR/speech API quota. The report is written to
`reports/real-media/<timestamp>.json` with per-item recognized text and CER, plus mean/median
CER overall, per kind and per `kind:language`.

## Reading the numbers

- CER = Levenshtein edit distance over normalized characters / expected length (0 is perfect;
  it can exceed 1 when the output has lots of extra text).
- Normalization: Unicode NFKC, case-folding, punctuation removed. For Thai, Lao, Khmer,
  Burmese, Chinese, Japanese and Tibetan all spaces are removed and characters are compared;
  other languages keep single spaces between words.
- Photos with many regions can score worse just because lines come back in a different order.
  Check `recognized_text` before concluding the OCR misread something.
- CER measures recognition only, not translation quality; dialect speech is often transcribed
  into Central Thai spelling, which shows up as CER even when the meaning is right. Note such
  cases rather than treating them as pure errors.
- A few dozen files is indicative, not a population accuracy score.
