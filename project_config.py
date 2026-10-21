"""Shared configuration, loaded relative to the project rather than the shell cwd."""

import os
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent
load_dotenv(PROJECT_ROOT / ".env")

MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
BASE_URL = os.getenv("GROQ_BASE_URL", "https://api.groq.com/openai/v1")
SPEECH_MODEL = os.getenv("GROQ_SPEECH_MODEL", "whisper-large-v3-turbo")
VISION_MODEL = os.getenv("GROQ_VISION_MODEL", "qwen/qwen3.8-27b")

MAX_TEXT = 30_000
MAX_UPLOAD = 10 * 1024 * 1024
MAX_PAGES = 20
TONES = {
    "natural": "natural and fluent",
    "formal": "formal and polite",
    "casual": "casual and conversational",
    "friendly": "friendly, warm and approachable",
}
