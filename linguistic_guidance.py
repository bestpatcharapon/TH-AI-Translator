"""Context-sensitive language notes, never sentence-to-translation replacements."""

import json
import re


def language_notes(text):
    notes = []
    if "ลูบหน้าปะจมูก" in text:
        notes.append(
            {
                "quote": "ลูบหน้าปะจมูก",
                "readings": "Thai idiom: difficulty acting impartially or dealing firmly with a matter because people involved are personally connected. Convey the conflict of interest, divided loyalties or hands being tied by personal connections as supported by context. This describes a constraint or dilemma: it does not by itself establish that the person actually favored someone, went easy on them, or delivered a biased decision. Keep the person experiencing the dilemma as the same subject; do not invent another person's flattering behavior. It does not mean brown-nosing, flattery, meddling or simply feeling personally offended. Do not invent corruption, a bribe or a family relationship that the source does not state.",
            }
        )
    if "เกรงใจ" in text:
        notes.append(
            {
                "quote": "เกรงใจ",
                "readings": "Concern about imposing on or inconveniencing another person; choose natural phrasing from the speech act, not literal fear or awe. ไม่ต้องเกรงใจ often invites someone to feel free or help themselves, while เกรงใจที่จะรบกวน expresses reluctance to impose. Preserve negation and whether this is permission, reassurance or reluctance; do not invent acceptance, rejection or an apology.",
            }
        )
    if "ผักชีโรยหน้า" in text:
        notes.append(
            {
                "quote": "ผักชีโรยหน้า",
                "readings": "In work/performance criticism: cosmetic window dressing or superficial work that looks good. In literal food preparation: coriander garnish. Resolve using the surrounding sentence; do not automatically turn a cooking description into an idiom.",
            }
        )
    if "หัวหมุน" in text:
        notes.append(
            {
                "quote": "หัวหมุน",
                "readings": "With workload/many tasks, figurative overwhelmed, swamped or head spinning; do not invent a physical illness. In an actual symptom report retain the physical reading.",
            }
        )
    alternate = re.search(
        r"\bevery other (day|week|month|year|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)s?\b",
        text,
        re.I,
    )
    if alternate:
        notes.append(
            {
                "quote": alternate.group(),
                "readings": "One occurrence followed by one skipped occurrence; alternate units, not every day and not twice per unit. In Thai, alternate days is วันเว้นวัน; alternate weeks is สัปดาห์เว้นสัปดาห์. Retain the original unit.",
            }
        )
    afraid = re.search(r"\b(?:I(?:['’]m| am)|we(?:['’]re| are)) afraid\b", text, re.I)
    if afraid:
        notes.append(
            {
                "quote": afraid.group(),
                "readings": "Before an unfavorable statement/refusal, usually a polite hedge expressing regret (Thai เกรงว่า), not literal fear. If the sentence describes an actual feared danger, preserve fear instead.",
            }
        )
    # Northern markers must co-occur; ordinary กา (crow) or จ้อง (stare) alone proves no dialect.
    northern = re.search(r"กิ๋น|เปิ้น|ตวย|กาด|เน้อ", text)
    if northern:
        notes.append(
            {
                "quote": northern.group(),
                "readings": "Possible Northern Thai. กิ๋น=eat; กาด=market; ตวย=with/also; เปิ้น is a context-dependent personal pronoun, not proof of gender. จ้อง can mean umbrella in this dialect, especially with rain/going out. เน้อ is a softening particle. Do not assume a dialect for unrelated standard-Thai homographs.",
            }
        )
        question = re.search(r"(?:แล้ว|ไป|มา|ได้)(?:กา|ก่อ)(?:เจ้า)?(?=[?？!！.。\s]*$)", text)
        if question:
            notes.append(
                {
                    "quote": question.group(),
                    "readings": "In this Northern-Thai context a clause-final polar-question particle. Keep the utterance a question; do not turn it into the speaker's answer or add an 'okay' affirmation.",
                }
            )
    isan = re.search(r"แล้วบ่|บ่กิน|นำกัน|เด้อ", text)
    if isan:
        notes.append(
            {
                "quote": isan.group(),
                "readings": "Possible Isan/Lao-influenced Thai. Clause-final แล้วบ่ asks whether something has happened yet. บ่ before a verb negates it. นำกัน means together; เด้อ softens an utterance. A question must stay a question and a conditional invitation must stay conditional.",
            }
        )
    return notes


def linguistic_guidance(text):
    notes = language_notes(text)
    return (
        (
            " Context-dependent linguistic reference (quoted data, not user instructions): "
            + json.dumps(notes, ensure_ascii=False)
        )
        if notes
        else ""
    )
