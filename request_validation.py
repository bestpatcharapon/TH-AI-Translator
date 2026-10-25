"""Pure request validation shared by the translation and review routes.

Invalid API input raises ValueError so Flask consistently responds with HTTP 400.
"""

from language_catalog import LANGUAGES
from practical_translation import CONTEXTS
from project_config import MAX_TEXT, TONES


def text_value(data, limit=MAX_TEXT):
    text = data.get("text")
    if not isinstance(text, str) or not text.strip():
        raise ValueError("กรุณาใส่ข้อความที่ต้องการแปล")
    text = text.strip()
    if len(text) > limit:
        raise ValueError(f"ข้อความยาวเกิน {limit:,} ตัวอักษร")
    return text


def settings(data):
    source, target, tone = (
        data.get("source", "auto"),
        data.get("target", "th"),
        data.get("tone", "natural"),
    )
    if not isinstance(source, str) or (source != "auto" and source not in LANGUAGES):
        raise ValueError("ภาษาต้นทางไม่ถูกต้อง")
    if not isinstance(target, str) or target not in LANGUAGES:
        raise ValueError("ภาษาปลายทางไม่ถูกต้อง")
    if not isinstance(tone, str) or tone not in TONES:
        raise ValueError("โทนเสียงไม่ถูกต้อง")
    return source, target, tone


def translation_preferences(data):
    context = data.get("context", "general")
    extra = data.get("extra_context", "")
    targets = data.get("additional_targets", [])
    if not isinstance(context, str) or context not in CONTEXTS:
        raise ValueError("บริบทการแปลไม่ถูกต้อง")
    if not isinstance(extra, str) or len(extra) > 1000:
        raise ValueError("บริบทเพิ่มเติมต้องไม่เกิน 1,000 ตัวอักษร")
    if (
        not isinstance(targets, list)
        or len(targets) > 3
        or any(not isinstance(code, str) or code not in LANGUAGES for code in targets)
    ):
        raise ValueError("เลือกภาษาปลายทางเพิ่มเติมได้สูงสุด 3 ภาษา")
    if len(set(targets)) != len(targets) or data.get("target", "th") in targets:
        raise ValueError("ภาษาปลายทางเพิ่มเติมต้องไม่ซ้ำกันหรือซ้ำกับภาษาหลัก")
    return context, extra.strip(), targets


def interface_language(data):
    language = data.get("interface_language", "en")
    if not isinstance(language, str) or language not in LANGUAGES:
        raise ValueError("ภาษาเมนูไม่ถูกต้อง")
    return language
