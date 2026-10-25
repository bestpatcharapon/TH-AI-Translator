# User-provided slang regression probe

`results.json` records four live `/api/translate` requests with `thai_mode`
omitted (Standard translation), Thai → English, natural tone, bypassing cache.
The project user supplied the contextual meaning of `สาดไปสมาชิก` before this
change. These are development examples, not a blind evaluation or a claim of
coverage of all contemporary slang.

The standalone expression returned “Go for it, buddy!” and the affirmative
sentence returned “Alright, go for it, buddy!”. Both received a Gemini review.
Literal document delivery retained “50 members”; the water-splashing control
remained literal. Numeric consistency and meaning are evaluated separately:
model review alone is not proof of correctness.

The lexical entry is passed as contextual reference data to generation and
review. No source sentence is replaced, no public source is fabricated, and no
model is trained. Other slang still depends on the model, context and available
definitions. A literal context containing the complete expression can still be
ambiguous and needs interpretation rather than unconditional replacement.
