"""Shared configuration, loaded relative to the project rather than the shell cwd."""

import os
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent
load_dotenv(PROJECT_ROOT / ".env")

MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
BASE_URL = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")
SPEECH_MODEL = os.getenv("GROQ_SPEECH_MODEL", "whisper-large-v3")
SPEECH_VERIFY_MODEL = os.getenv(
    "GROQ_SPEECH_VERIFY_MODEL",
    "whisper-large-v3-turbo" if SPEECH_MODEL != "whisper-large-v3-turbo" else "whisper-large-v3",
)
CHAT_REASONING_EFFORT = os.getenv(
    "GROQ_CHAT_REASONING_EFFORT", "medium" if MODEL.startswith("openai/gpt-oss") else ""
)
VISION_MODEL = os.getenv("GROQ_VISION_MODEL", "qwen/qwen3.8-27b")
SEMANTIC_REVIEW_ENABLED = os.getenv("SEMANTIC_REVIEW_ENABLED", "1") != "0"
# Accuracy-first default. Set to "low" for lower latency or "" for provider default.
TRANSLATION_REASONING_EFFORT = os.getenv(
    "GROQ_TRANSLATION_REASONING_EFFORT", "medium" if MODEL.startswith("openai/gpt-oss") else ""
)

MAX_TEXT = 30_000
MAX_UPLOAD = 10 * 1024 * 1024
MAX_PAGES = 20
TONES = {
    "standard": "neutral and faithful",
    "natural": "natural and fluent",
    "formal": "formal and polite",
    "casual": "casual and conversational",
    "friendly": "friendly, warm and approachable",
    "business": "professional, concise and businesslike",
}
STYLE_RULES = {
    "standard": (
        "Use neutral, direct wording close to the source structure where idiomatic. "
        "Avoid stylistic embellishment and unnecessary paraphrasing; do not force word-for-word errors."
    ),
    "natural": (
        "Use idiomatic everyday phrasing and natural target-language word order. "
        "Rephrase awkward literal constructions without adding or removing meaning."
    ),
    "formal": (
        "Use complete sentences, respectful vocabulary and an appropriate formal register. "
        "Avoid slang, chat abbreviations and casual contractions where inappropriate."
    ),
    "casual": (
        "Use relaxed spoken phrasing and everyday vocabulary, with natural contractions where suitable. "
        "Do not add profanity, intimacy or slang absent from the source."
    ),
    "friendly": (
        "Use approachable, considerate wording with a warm conversational register. "
        "Do not invent greetings, thanks, compliments, emojis or personal familiarity."
    ),
    "business": (
        "Use concise, professional wording suited to workplace or client communication, "
        "with clear requests and consistent domain terms. Avoid decorative corporate jargon. "
        "Do not invent commitments, deadlines, approvals or legal force."
    ),
}


def tone_description(tone):
    """Carry the same style requirements through translation, OCR and review paths."""
    return (
        f"{TONES[tone]} register. {STYLE_RULES[tone]} "
        "Preserve facts, numbers, negation, uncertainty and the strength of source insults. "
        "Do not add or omit meaning to achieve a style."
    )
