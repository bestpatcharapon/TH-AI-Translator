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
    "natural": "natural and fluent",
    "formal": "formal and polite",
    "casual": "casual and conversational",
    "friendly": "friendly, warm and approachable",
}
