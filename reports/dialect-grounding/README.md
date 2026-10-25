# Sourced dialect interpretation — development regression

This change retrieves attributed lexical facts and parallel examples before model
interpretation. It does not train new model weights or claim general dialect fluency.

## Sources and scope

- [Thai Local Language Translation Dataset v1](https://zenodo.org/records/13283454),
  Wannaphong Phatthiyaphaibun, 2024, CC BY-SA 4.0. Local index contains 8,029
  Khummuang, 3,627 Korat and 3,591 Pattani source/translation pairs. Retrieval for
  Northern mode only queries Khummuang. Auto mode permits exact sentence matches
  from explicitly labeled varieties. Korat is not relabeled Isan, nor Pattani generic
  Southern Thai. Corpus examples can be noisy; they are not authoritative definitions.
- [Word Formations of Lanna Swear Words in Facebook](https://so03.tci-thaijo.org/index.php/Humanties-up/article/download/210068/170598/),
  Sarawut Lordee and Karankorn Boonpa, 2021, printed p.119: classifies the reported
  expression as swearing and analyzes its components. This is a short factual
  citation, not a copied dictionary built from the paper.
- [Northern dictionary entry](https://xn--q3cn1ail0ab6b0e.com/dict/%E0%B8%9B%E0%B9%89%E0%B8%AD%E0%B8%84%E0%B8%B4%E0%B8%87%E0%B8%AB%E0%B8%A2%E0%B8%B1%E0%B8%87/):
  gives the Central Thai gloss “พ่อมึงเหรอ”. The application adds the user-reported
  spelling alias “ป่อคิงหยัง”; the alias is not a separate attestation.

The small lexical reference file also identifies literal “ป้อ” as father. Conservative
matching excludes standard-Thai words such as ป้องกัน, ป้อนข้าว and ป้อมปราการ.
Personal definitions still describe the user's private intended usage and are not
silently overridden by public references.

## Pipeline

1. Local lookup (observed ~20–30ms in a few development queries), no live web lookup.
2. Groq generates interpretation and translation from the original source, with
   references supplied as quoted data. Related examples are not whole-sentence replacements.
3. If configured, Gemini independently checks the Central Thai meaning and final
   translation. Exact source quotes and factual consistency remain validated in code.
4. A malformed draft can be repaired by the second model; it is not accepted with
   fabricated quotations. If Groq is unavailable, Gemini can generate a replacement,
   but this is marked `not_requested / primary_provider_unavailable`, not independently checked.
5. A whole sourced expression that still contradicts the lexical reference is held
   for clarification. New/private meanings without support can still require the speaker.

References appear in a collapsed “Reference material found” section, with distinct
labels for related examples. Finding a reference does not certify every model claim.

## Real runs

- `results.json`: initial development run. The last committed generator interpreted
  the reported retort as a neutral activity question. The first sourced attempt failed
  strict validation because the model quoted reference titles as source wording.
  Other initial failures included rate limits. These failures have been retained.
- `final-results.json`: six subsequent development probes after schema repair.
  “ป่อคิงหยัง” → Central Thai “พ่อมึงเหรอ”; a request to speak slowly remains a request;
  literal father-going-to-market remains literal; quoted discussion stays discussion;
  an invented private phrase requests context. Responses included one primary-provider
  fallback, so not every response had two independent model passes.
- English output for the isolated retort was **“Your dad?”** with an explicit insult
  explanation. This is too literal to establish a fully idiomatic English equivalent
  or perfect register preservation. Central Thai is better grounded than this English
  rendering. Context and native-speaker review are still needed.
- `contrast-results.json`: novel negation/quantity probes produced “Don't speak loudly”
  and “Don't take 50, take 5.” The first review was unavailable, so it remains explicitly
  unverified despite a plausible translation.

No blind human evaluation, held-out accuracy percentage, or Google-level claim is
made. The reported case was used during development, and the slow-speech example
has a related corpus example. The corpus is intentionally reference material, not
held-out test data. Generated explanations can still overstate meaning, and source
availability does not resolve every dialect ambiguity. The final six-probe run took
roughly 3–4 seconds per request on this connection, including optional review;
these observations are not a latency guarantee or a comparison with the faster
single-pass baseline.

## Reproduce

```bash
.venv/bin/python scripts/setup_dialect_references.py
# inspect cases without calling any model
.venv/bin/python scripts/benchmark_dialect_quality.py
# consume configured provider quota
.venv/bin/python scripts/benchmark_dialect_quality.py --live
```

Setup verifies the downloaded CSV's SHA-256 before building a temporary SQLite
index and atomically replacing the active index. The index is optional and ignored
by Git; missing/corrupt optional indexes do not block normal translation. Lexical
reference changes and index replacement invalidate relevant API cache identities.
Do not redistribute the generated corpus adaptation without its CC BY-SA attribution.

An additional register experiment (`english-register.json`) asked the model for a
more idiomatic rude English retort. It returned **“The fuck is your dad?”**, which is
unnatural, changes the question's function and escalates the wording. Gemini also
accepted it. That prompt addition was **reverted**, and this failed result is retained
as evidence that two-model agreement is not proof of correctness. The application
does not claim a verified idiomatic English equivalent for this isolated retort.
