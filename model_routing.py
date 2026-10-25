"""Optional cross-provider meaning review; ordinary translations stay on Groq."""

import os
from functools import lru_cache

from openai import OpenAI

from project_config import MODEL
from semantic_review import LIMIT, review_reasons

GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"
DEFAULT_REVIEW_MODEL = "gemini-3.5-flash-lite"


def routing_identity():
    """Non-secret settings that affect cached results."""
    return (
        os.getenv("TRANSLATION_REVIEW_PROVIDER", "groq").strip().lower(),
        os.getenv("GEMINI_REVIEW_MODEL", DEFAULT_REVIEW_MODEL),
        bool(os.getenv("GEMINI_API_KEY")),
    )


@lru_cache(maxsize=1)
def _gemini_client(api_key):
    return OpenAI(api_key=api_key, base_url=GEMINI_BASE_URL, timeout=15, max_retries=0)


def review_route(
    primary_client,
    text,
    draft,
    source,
    target,
    context,
    glossary,
    conversation,
    *,
    chat=False,
    enabled=True,
):
    provider, model, configured = routing_identity()
    # Conversation alone is not enough to pay for a second provider on every chat turn.
    reasons = review_reasons(text, context, glossary, conversation, chat)
    eligible = (
        enabled
        and source != target
        and len(text) <= LIMIT
        and len(draft) <= LIMIT * 3
        and any(reason != "conversation" for reason in reasons)
    )
    if provider == "gemini" and configured and eligible:
        return _gemini_client(os.environ["GEMINI_API_KEY"]), model, "gemini"
    return primary_client, MODEL, "groq"


def dialect_review_route():
    """Select an independent dialect reviewer only when explicitly configured."""
    provider, model, configured = routing_identity()
    if provider == "gemini" and configured:
        return _gemini_client(os.environ["GEMINI_API_KEY"]), model, provider
    return None, MODEL, "groq"
