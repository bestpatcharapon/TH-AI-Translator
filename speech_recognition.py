"""Inspect Whisper segment evidence without inventing an accuracy percentage."""

import io
import json
import math
import re
import unicodedata
import wave


def transcription_prompt(raw):
    """Accept a small spelling vocabulary, never another feature's conversation."""
    if raw is None:
        return ""
    try:
        words = json.loads(raw)
    except (TypeError, ValueError) as error:
        raise ValueError("คำศัพท์ช่วยถอดเสียงไม่ถูกต้อง") from error
    if not isinstance(words, list) or len(words) > 16:
        raise ValueError("คำศัพท์ช่วยถอดเสียงไม่ถูกต้อง")
    if any(
        not isinstance(word, str)
        or not word.strip()
        or len(word) > 120
        or re.search(r"[\x00-\x1f]", word)
        for word in words
    ):
        raise ValueError("คำศัพท์ช่วยถอดเสียงไม่ถูกต้อง")
    prompt = ", ".join(dict.fromkeys(word.strip() for word in words))
    # A UTF-8 byte budget stays below the provider's 224-token prompt allowance.
    if len(prompt.encode("utf-8")) > 200:
        raise ValueError("คำศัพท์ช่วยถอดเสียงยาวเกินขีดจำกัด")
    return prompt


def compare_transcripts(primary, secondary):
    """Keep the original recognition; disagreement is evidence to review, not to rewrite."""

    def normalized(text):
        return "".join(
            char
            for char in unicodedata.normalize("NFKC", text).casefold()
            if unicodedata.category(char)[0] in {"L", "M", "N"}
        )

    reasons = set(primary["review_reasons"])
    if normalized(primary["text"]) != normalized(secondary["text"]):
        reasons.add("model_disagreement")
        primary["alternative_text"] = secondary["text"]
    if secondary["review_required"]:
        reasons.add("verification_unclear")
    primary["review_reasons"] = sorted(reasons)
    primary["review_required"] = bool(reasons)
    primary["verification_model"] = secondary["model"]
    return primary


def reject_silent_pcm(data):
    """Reject digital silence in PCM WAV uploads before paying for recognition."""
    if data[:4] != b"RIFF" or data[8:12] != b"WAVE":
        return
    try:
        with wave.open(io.BytesIO(data), "rb") as audio:
            frames = audio.readframes(audio.getnframes())
            midpoint = 128 if audio.getsampwidth() == 1 else 0
            if frames and not any(value != midpoint for value in frames):
                raise ValueError("ไม่พบเสียงพูด กรุณาตรวจไมโครโฟนแล้วบันทึกใหม่")
    except (wave.Error, EOFError):
        # Other encodings are decoded by the speech provider.
        return


def _number(segment, key):
    value = segment.get(key)
    if isinstance(value, bool) or not isinstance(value, (float, int)):
        return None
    return value if math.isfinite(value) else None


def transcript_result(result, model):
    text = (result.text or "").strip()
    if not text:
        raise ValueError("ไม่พบเสียงพูด กรุณาลองบันทึกใหม่")
    segments = getattr(result, "segments", None)
    if not isinstance(segments, list) or not segments:
        return dict(text=text, model=model, review_required=True, review_reasons=["no_metadata"])
    reasons = set()
    # Observed high-confidence Thai ASR substitutions, not automatic corrections.
    # Require a second fandom cue so ordinary domains/boxes/names remain unaffected.
    confusions = re.findall(r"มือกล่อง|ดอมเมน", text)
    surrounding = re.sub(r"มือกล่อง|ดอมเมน", " ", text)
    if confusions and (
        len(confusions) > 1
        or re.search(r"ด้อม|(?<!โด)(?<!คอม)เมน(?!ู|ต์|บอร์ด)|นักร้อง|วงดนตรี|แฟนคลับ|มือกลอง", surrounding)
    ):
        reasons.add("possible_word_confusion")
    silent = 0
    for segment in segments:
        if hasattr(segment, "model_dump"):
            segment = segment.model_dump()
        if not isinstance(segment, dict):
            reasons.add("no_metadata")
            continue
        probability = _number(segment, "no_speech_prob")
        logprob = _number(segment, "avg_logprob")
        compression = _number(segment, "compression_ratio")
        if any(value is None for value in (probability, logprob, compression)):
            reasons.add("no_metadata")
        if probability is not None and probability > 0.6:
            reasons.add("possible_silence")
        if logprob is not None and logprob < -0.8:
            reasons.add("unclear_audio")
        if compression is not None and compression > 2.4:
            reasons.add("repetition")
        if probability is not None and probability > 0.8 and logprob is not None and logprob < -1:
            silent += 1
    if silent == len(segments):
        raise ValueError("เสียงพูดไม่ชัดหรือมีแต่เสียงเงียบ กรุณาบันทึกใหม่ใกล้ไมค์ขึ้น")
    return dict(
        text=text, model=model, review_required=bool(reasons), review_reasons=sorted(reasons)
    )
