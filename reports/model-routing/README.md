# Model routing baseline — 2026-10-24

`groq-baseline.json` contains real GPT-OSS 120B outputs on eight Thai-English
sentences, measured sequentially in one run. All eight requests completed normally.
Median elapsed time: 0.6895 seconds. Estimated token cost: USD 0.00137535 total,
using Groq's published USD 0.15 / 0.60 per million input/output tokens.
These are raw single-pass translations, not end-to-end app or OCR latency.
This small run is not an overall accuracy evaluation or proof of superiority.

A clear remaining error: “ลูบหน้าปะจมูก” was translated as “brown-nosing”.
That does not convey the difficulty of acting impartially because the people involved
are connected to someone. This example still needs improvement and human review;
completion success does not mean semantic correctness.

Gemini was not called: no GEMINI_API_KEY was configured. No comparative ranking
is available. The default production provider has not been switched based on this run.
Once a key is configured locally, run:

```bash
.venv/bin/python scripts/compare_translation_models.py --live
```

Compare outputs without revealing provider labels to reviewers, and evaluate
meaning, unsupported additions, omissions, numbers and natural wording before
changing the default. Repeat timing measurements before drawing latency conclusions.

## Gemini comparison completed

After the Gemini credential was configured locally, both providers completed all
eight raw single-pass translations. See `groq-gemini-comparison.json`.

| Provider | Median seconds/request | Estimated USD for eight requests |
| --- | ---: | ---: |
| Groq GPT-OSS 120B | 0.667 | 0.001379 |
| Gemini 3.5 Flash-Lite | 0.8905 | 0.001599 |

These totals include usage reported by the providers, not just visible translated
text, but exclude other app calls, review, OCR, tax and billing adjustments.
A single run of eight sentences cannot establish overall accuracy or stable latency.

Both preserved 150 / 50 / 5 correctly. Both still mishandled the idiom
“ลูบหน้าปะจมูก”: Groq produced “brown-nosing”; Gemini produced “hits too close to
home” and shifted the refusal into past tense. Neither explicitly captures being
unable to act impartially because of personal connections. On the Isan example,
Gemini's “tomorrow” is more specific than Groq's “another day”. These are qualitative
observations, not blind ratings or a general model ranking.

The local app now uses Groq for primary translation and Gemini for eligible
meaning reviews. This does not replace photo OCR, speech transcription or the
specialized dialect-interpretation route. API keys are never included in reports.

## Everyday meaning regression — 2026-10-24

`everyday-before.json` and `everyday-after.json` record six real hybrid API requests
with cache bypassed, before and after context-sensitive guidance changes. Two new
uses of “ลูบหน้าปะจมูก” previously produced flattering behavior or literal face/nose
rubbing; the final run describes hands being tied or a conflict of interest.
Guidance distinguishes a dilemma from an allegation that someone has already
made a biased decision. “เกรงใจ” now triggers contextual review for both invitations
and reluctance to impose. The payment condition and the literal coriander garnish
with a 50-baht price remain present in the final outputs.

This was a small development regression set, inspected by the coding assistant,
with iterative prompt tuning on these examples. It is not held-out evidence of an
overall accuracy gain, a blind human evaluation or proof of superiority to Google.
Natural wording still varies between runs. Gemini review returned `unavailable`
for the food example, so that draft remains explicitly unverified. HTTP 200 only
means that a translation response was delivered, not that all meaning was verified.
Additional targeted review adds latency and provider usage; ordinary text without
recognized risk still avoids it. Recheck with fresh examples and native speakers.

## Broader meaning checks — 16 sentences / 8 source languages

`tests/data/everyday_translation_challenge.json` is a new development challenge
with human-readable meaning criteria. Run it without API calls to inspect the set:

```bash
.venv/bin/python scripts/benchmark_everyday_quality.py
.venv/bin/python scripts/benchmark_everyday_quality.py --live
```

The initial run (`challenge-before.json`) completed 11 requests; five returned HTTP
429. The follow-up (`challenge-after.json`) completed all 16, sequentially with a
four-second pause between requests. Its median successful request took 1.715s,
including optional review. This is not a controlled speed comparison: pacing and
concurrency changed, and the failure rows are retained rather than counted as fast
translations. No automatic request retry is hidden in these results.

Before this change, payment-only-after-receipt, price relationships, and the
Japanese/Chinese/Korean examples did not trigger review. The follow-up adds checks
for these cases and for German/French/Spanish conditions. Two simple control
sentences still skip the extra provider call. Review labels are model judgments,
not correctness scores. In the follow-up 9 were kept, 4 revised, 2 not reviewed,
and 1 review was unavailable because its response failed validation.

One review introduced female Thai sentence endings into a Korean source without
that information. The final policy adds target-language guidance to the reviewer
and rejects new unsupported Thai gendered endings during revision. The guard is
conservative: it preserves the draft and reports rejection, rather than claiming
that a rejected draft is now verified. It is not a complete gender-bias detector.
`final-regression.json` contains three later requests; the Korean output is neutral,
and the deposit/total/balance values remain 500/1500/1000. Some reviews still fail
strict validation and remain explicitly unverified. Whitespace-only changes in a
`keep` response now preserve the original draft byte for byte; content-changing
`keep` responses remain invalid.

Additional targets now use the same bounded review path. A clarification cannot
be silently saved as an additional translation. Failed optional reviews are visible
on additional result cards; failed/ambiguous extra results are not cached as fully
successful groups. No feature state is shared by these changes.

Limits: rules are conservative triggers, not comprehensive language understanding.
Automatic meaning review still covers only source text up to 3,000 characters;
long documents retain the existing chunking and factual audit. OCR/transcription
models are unchanged. A larger blind evaluation by native speakers is still needed.
More triggered reviews use more quota and can increase latency. No guarantee of
Google-level accuracy, unlimited free-tier throughput or maximum attainable quality
is implied by this development set.
