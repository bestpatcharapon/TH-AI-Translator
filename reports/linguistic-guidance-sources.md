# Language reference and limits

`linguistic_guidance.py` provides context-dependent possible readings, not complete
sentence replacements. Known failures from the first comparison informed these
notes; repeating those cases is a regression check, not unseen evidence of general
accuracy. Additional sentence tests are recorded separately.

- Figurative ผักชีโรยหน้า and the literal garnish reading: [Chiang Mai University linguistic analysis](https://archive.lib.cmu.ac.th/full/T/2557/th50757jps_ch4.pdf).
- Northern Thai grammar and a polar question ending in กา: [Northern Thai teaching reference](https://elon.io/grammar/thai/variation/northern), [Northern Thai grammar publication](https://books.google.com/books/about/ไวยากรณ์ภาษาไทยถิ่นเหนือ.html?id=PGD7V3WmdGgC).
- Dialect จ้อง in ร่มโบราณ: [Mae Wang municipal local knowledge](https://maewang.go.th/travels.php).
- Isan บ่ before verbs vs in question position: [Isan dictionary entry](https://esan108.com/dict/view/บ่).

These references do not validate every local accent or colloquial spelling. The
model still has to resolve context, pronouns and complete sentence meaning. Speech
recognition is separate: guidance cannot recover words that the microphone omitted.
