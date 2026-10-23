"""Conservative review triggers, not language identification or accuracy scores."""

import json
import re
import unicodedata

# Rules only decide whether a second pass is useful. They never replace source text.
PATTERNS = {
    "negation_or_exception": r"ไม่|อย่า|ห้าม|เว้นแต่|ยกเว้น|\b(?:not|never|no|without|unless|except|don't|cannot|can't|won't|wouldn't|hasn't|haven't|isn't|aren't|hadn't|doesn't|didn't|needn't|mustn't|shouldn't|couldn't)\b",
    "condition_or_health": r"ถ้า|หาก|แพ้|มิลลิกรัม|ก็ต่อเมื่อ|ตราบใด|จนกว่า|\b(?:if|unless|until|provided|providing|allerg\w*|dose|dosage|mg)\b",
    "multilingual_negation": r"ない|ません|禁止|不要|取消しない|不|没|無|无|않|없|금지|아직|\b안\s|không|chưa|\b(?:nicht|kein\w*|nie|nunca|jamás|sin)\b|\bne\b.{0,50}\b(?:pas|jamais|plus)\b",
    "multilingual_condition": r"だけ|場合|なら|たら|ても|除[了外]|只有|如果|除非|只要|[으]?면|경우|nếu|trừ khi|\b(?:nur\s*,?\s*wenn|wenn|sofern|falls|si|à\s+moins\s+que|a\s+menos\s+que|siempre\s+que)\b",
    "uncertainty_or_permission": r"อาจจะ|ยังยืนยัน|ไม่แน่ใจ|น่าจะ|ไม่จำเป็น|อนุญาต|\b(?:might|perhaps|probably|may\s+have|allowed\s+to|permitted\s+to|either\b.{0,60}\bor)\b",
}
COMPILED = {name: re.compile(pattern, re.I) for name, pattern in PATTERNS.items()}
HINTS = {
    "condition_or_health": "Keep the condition attached to its action: only if, unless and until have different scope. An allergy is not a preference. Translate the report, without giving advice.",
    "multilingual_condition": "Preserve restrictions and exceptions in the original script. Only, except and unless do not grant unconditional permission.",
    "negation_or_exception": "Distinguish prohibition (must not), lack of obligation (need not), not yet, and not necessarily. Preserve which clause is negated and double-negation scope.",
    "multilingual_negation": "Negation and not-yet markers in this language must survive translation. Do not mistake a request not to cancel for a cancellation request.",
    "uncertainty_or_permission": "Keep uncertainty separate from a promise or a confirmed event. Permission is not an obligation. Either-but-not-both excludes choosing both.",
    "time_or_quantity_relationship": "Preserve which value is original, revised, total, deposit or balance; keep before/after and from/to direction. Do not sum, convert, or reverse values. Keep relative dates relative.",
}


def risk_signals(text):
    normalized = unicodedata.normalize("NFKC", text).replace("’", "'").replace("‘", "'")
    signals = [name for name, pattern in COMPILED.items() if pattern.search(normalized)]
    if (
        len(re.findall(r"\d+(?:[.,:]\d+)*", normalized)) >= 2
        and re.search(
            r"จาก|เหลือ|มัดจำ|ยอดรวม|ก่อน|หลัง|เลื่อน|\b(?:from|to|before|after|deposit|total|balance|instead)\b",
            normalized,
            re.I,
        )
    ) or re.search(
        r"มะรืน|วันเว้นวัน|สัปดาห์เว้นสัปดาห์|\b(?:day\s+after\s+tomorrow|every\s+other)\b", normalized, re.I
    ):
        signals.append("time_or_quantity_relationship")
    return signals


def risk_hints(text):
    return [HINTS[name] for name in risk_signals(text)]


def risk_guidance(text):
    hints = risk_hints(text)
    return (
        " Source-specific meaning checks: " + json.dumps(hints, ensure_ascii=False) if hints else ""
    )
