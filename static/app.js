const $ = (id) => document.getElementById(id);
const sourceEl = $("source"),
  targetEl = $("target"),
  inputEl = $("input"),
  outputEl = $("output");
const statusEl = $("status"),
  translateBtn = $("translate");
const LANGUAGES = {
  auto: ["Detect language", "อัตโนมัติ", "🌐", ""],
  ...Object.fromEntries(
    Object.entries(LANGUAGE_CATALOG).map(([code, entry]) => [
      code,
      [entry.name, entry.native, "🌐", entry.locale],
    ])
  ),
};
const languageFlag = (code) => `/static/flags/${LANGUAGE_CATALOG[code]?.flag || "auto"}.svg`;
const COPY = {
  en: {
    source: "Source",
    translation: "Translation",
    clear: "Clear",
    copy: "Copy",
    translate: "Translate",
    text: "Text",
    image: "Image",
    document: "Document",
    live: "Live Chat",
    tone: "Translation tone",
    natural: "Natural",
    formal: "Formal",
    casual: "Casual",
    placeholder: "Type or paste text to translate...",
    empty: "Please enter some text.",
    waiting: "Waiting for you to finish typing…",
    loading: "Translating…",
    done: "Translation complete",
    failed: "Could not complete the request. Please try again.",
    copied: "Copied to clipboard",
    copyFailed: "Could not copy. Select the text to copy it.",
    recording: "Recording… Tap the microphone again to stop (up to 60 seconds).",
    transcribing: "Transcribing your recording…",
    micError: "Could not use the microphone. Allow access and try again.",
    micUnsupported:
      "Recording needs HTTPS or localhost and a browser that supports microphone access.",
    noSpeech: "No speech detected. Please try again.",
    speechError: "Could not play audio. Please try again.",
    speechLoading: "Preparing audio…",
    speechPlaying: "Playing audio · tap the speaker again to stop",
    lightTheme: "Switch to light theme",
    darkTheme: "Switch to dark theme",
    remove: "Remove",
    chooseDocument: "Choose or drop a document",
    documentHint: "TXT, MD, CSV, PDF, DOCX · 10 MB · PDF up to 20 pages",
    extracting: "Reading your file…",
    extracted: "Text extracted. You can edit it and translate again.",
    fileTooLarge: "File is larger than 10 MB.",
    fileUnsupported: "This file type is not supported in this mode.",
    tooLong: "Text exceeds the character limit. Split it before translating.",
    clearChat: "Clear chat",
    chatEmpty: "Your conversation will appear here.",
    autoSpeak: "Read translations aloud",
    send: "Send",
    message: "Your message",
    chatPlaceholder: "Type a message, or use the microphone…",
    chooseSpeaker: "Choose Thai or another source language for two-way conversation.",
  },
  th: {
    source: "ข้อความต้นฉบับ",
    translation: "คำแปล",
    clear: "ล้าง",
    copy: "คัดลอก",
    translate: "แปลภาษา",
    text: "ข้อความ",
    image: "รูปภาพ",
    document: "เอกสาร",
    live: "แชทสด",
    tone: "น้ำเสียงในการแปล",
    natural: "ธรรมชาติ",
    formal: "ทางการ",
    casual: "กันเอง",
    placeholder: "พิมพ์หรือวางข้อความที่ต้องการแปล...",
    empty: "กรุณาใส่ข้อความ",
    waiting: "รอพิมพ์เสร็จแล้วแปลอัตโนมัติ…",
    loading: "กำลังแปล…",
    done: "แปลเสร็จแล้ว",
    failed: "ดำเนินการไม่สำเร็จ กรุณาลองอีกครั้ง",
    copied: "คัดลอกแล้ว",
    copyFailed: "คัดลอกไม่สำเร็จ กรุณาเลือกข้อความเพื่อคัดลอก",
    recording: "กำลังบันทึกเสียง… กดไมค์อีกครั้งเพื่อหยุด (สูงสุด 60 วินาที)",
    transcribing: "กำลังถอดเสียง…",
    micError: "ใช้ไมโครโฟนไม่ได้ กรุณาอนุญาตสิทธิ์แล้วลองอีกครั้ง",
    micUnsupported:
      "การบันทึกเสียงต้องเปิดผ่าน HTTPS หรือ localhost และใช้เบราว์เซอร์ที่รองรับไมโครโฟน",
    noSpeech: "ไม่พบเสียงพูด กรุณาลองใหม่",
    speechError: "เล่นเสียงไม่สำเร็จ กรุณาลองอีกครั้ง",
    speechLoading: "กำลังเตรียมเสียง…",
    speechPlaying: "กำลังอ่านออกเสียง · กดปุ่มลำโพงอีกครั้งเพื่อหยุด",
    lightTheme: "เปลี่ยนเป็นธีมสว่าง",
    darkTheme: "เปลี่ยนเป็นธีมเข้ม",
    remove: "นำออก",
    chooseDocument: "เลือกเอกสารหรือลากไฟล์มาวาง",
    documentHint: "TXT, MD, CSV, PDF, DOCX · 10 MB · PDF สูงสุด 20 หน้า",
    extracting: "กำลังอ่านข้อความจากไฟล์…",
    extracted: "อ่านไฟล์แล้ว สามารถแก้ไขข้อความและแปลใหม่ได้",
    fileTooLarge: "ไฟล์มีขนาดเกิน 10 MB",
    fileUnsupported: "โหมดนี้ไม่รองรับไฟล์ประเภทนี้",
    tooLong: "ข้อความเกินขีดจำกัด กรุณาแบ่งข้อความก่อนแปล",
    clearChat: "ล้างแชท",
    chatEmpty: "บทสนทนาของคุณจะแสดงที่นี่",
    autoSpeak: "อ่านคำแปลออกเสียง",
    send: "ส่ง",
    message: "ข้อความของคุณ",
    chatPlaceholder: "พิมพ์ข้อความ หรือกดไมโครโฟน…",
    chooseSpeaker: "กรุณาเลือกภาษาต้นทางเพื่อสนทนาแปลสองทาง",
  },
};
Object.assign(COPY.en, { doneIn: "Translation complete · {seconds}s" });
Object.assign(COPY.th, { doneIn: "แปลแล้ว · {seconds} วินาที" });
let locale = "en",
  mode = "text",
  reverseSpeaker = false;
let selectedFilename = "",
  modeEpoch = 0;
const activeFeature = () => featureWorkspaces.get(mode);
let composing = false,
  compositionOwner = null;
const AUTO_TRANSLATE_DELAY = 450;
let recorder = null,
  mediaStream = null,
  recordTimer = null,
  recordingEpoch = 0,
  micStarting = false;
let audioController = null,
  audioPlayer = null,
  audioUrl = null,
  audioButton = null,
  audioEpoch = 0;
const conversation = featureWorkspaces.get("live").conversation;
const t = (key) => COPY[locale]?.[key] || COPY.en[key] || key;
const maxInput = () => (["image", "document"].includes(mode) ? 30000 : 5000);
function setStatus(message = "", error = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", error);
  if (mode === "live") {
    $("live-status").textContent = message;
    $("live-status").classList.toggle("error", error);
  }
}
function voiceStatus(message = "", error = false) {
  $("voice-status").textContent = message;
  $("voice-status").classList.toggle("error", error);
}
function fileStatus(message = "", error = false) {
  $("file-status").textContent = message;
  $("file-status").classList.toggle("error", error);
}
function resizeSourceInput() {
  inputEl.style.height = "";
  if (mode === "live" || mode === "image") return;
  const styles = getComputedStyle(inputEl),
    minimum = parseFloat(styles.minHeight) || 180,
    maximum = parseFloat(styles.maxHeight) || 420;
  inputEl.style.height = "auto";
  inputEl.style.height = `${Math.min(maximum, Math.max(minimum, inputEl.scrollHeight))}px`;
}
window.addEventListener("resize", resizeSourceInput);
function updateInput() {
  inputEl.maxLength = maxInput();
  const text = inputEl.value;
  $("clear").hidden = text.length === 0;
  let words = text.trim().split(/\s+/u).filter(Boolean).length;
  try {
    if (Intl.Segmenter)
      words = Array.from(
        new Intl.Segmenter(sourceEl.value === "auto" ? undefined : sourceEl.value, {
          granularity: "word",
        }).segment(text)
      ).filter((part) => part.isWordLike).length;
  } catch {
    /* Whitespace count remains available on older browsers. */
  }
  const characters = Array.from(text).length;
  $("count").textContent = t("wordCharacterCount")
    .replace("{words}", words)
    .replace("{characters}", characters);
  $("count").title = `${text.length} / ${maxInput()}`;
  $("count").hidden = !inputEl.value.length;
  translateBtn.hidden = !inputEl.value.trim();
  resizeSourceInput();
}
function updateOutput() {
  for (const id of ["copy", "speak-output"]) $(id).hidden = !outputEl.value;
}
function cancelAutoTranslation() {
  clearTimeout(activeFeature().timer);
  activeFeature().timer = null;
}
function scheduleAutoTranslation() {
  cancelAutoTranslation();
  if (mode === "live" || mode === "image" || composing || !inputEl.value.trim()) return;
  if (inputEl.value.trim().length > maxInput()) {
    setStatus(t("tooLong"), true);
    return;
  }
  setStatus(t("waiting"));
  const workspace = activeFeature(),
    epoch = modeEpoch;
  workspace.timer = setTimeout(() => {
    workspace.timer = null;
    if (activeFeature() !== workspace || modeEpoch !== epoch) return;
    translate();
  }, AUTO_TRANSLATE_DELAY);
}
function cancelOperation() {
  cancelAutoTranslation();
  const wasExtracting = $("file-tools").getAttribute("aria-busy") === "true";
  activeFeature().request?.abort();
  activeFeature().request = null;
  translateBtn.disabled = false;
  $("live-send").disabled = false;
  $("choose-file").disabled = false;
  document.querySelector(".output-panel").setAttribute("aria-busy", "false");
  $("file-tools").setAttribute("aria-busy", "false");
  if (mode === "document") $("retry-file").hidden = !activeFeature().needsExtraction;
  if (wasExtracting && $("file-status").textContent === t("extracting")) fileStatus();
  if ($("voice-status").textContent === t("transcribing")) voiceStatus();
  if ($("microphone").dataset.voiceState === "transcribing") setMicrophoneState("idle");
}
function startOperation() {
  cancelOperation();
  activeFeature().request = new AbortController();
  activeFeature().request.owner = mode;
  activeFeature().request.epoch = modeEpoch;
  return activeFeature().request;
}
function ownsOperation(controller) {
  return (
    activeFeature().request === controller &&
    controller.owner === mode &&
    controller.epoch === modeEpoch &&
    !controller.signal.aborted
  );
}
function invalidateTranslation() {
  cancelOperation();
  outputEl.value = "";
  updateOutput();
  setStatus();
  document.dispatchEvent(new CustomEvent("translation:invalidated"));
}
function commitTranslation(detail) {
  outputEl.value = detail.translation;
  outputEl.lang = detail.target;
  updateOutput();
  setStatus(t("done"));
  document.dispatchEvent(
    new CustomEvent("translation:complete", { detail: { ...detail, feature: mode } })
  );
}
async function responseJson(response) {
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(t("failed"));
  }
  if (!response.ok) {
    const error = new Error(data.error || t("failed"));
    error.status = response.status;
    error.code = data.code;
    error.retryAfter = Number(data.retry_after || response.headers.get("Retry-After")) || 0;
    throw error;
  }
  return data;
}
function translationOptions() {
  const preferences = activeFeature().preferences;
  return {
    ...(typeof thaiTranslationOptions === "function" ? thaiTranslationOptions() : {}),
    cache_scope: mode,
    defer_additional: true,
    context: preferences.context,
    extra_context: preferences.extraContext,
    glossary: activeFeature().glossary.map((entry) => ({ ...entry })),
    additional_targets: preferences.multiple
      ? preferences.targets.filter((code) => code !== activeLanguages()[1])
      : [],
  };
}
function activeLanguages() {
  return mode === "live" && reverseSpeaker
    ? [targetEl.value, sourceEl.value]
    : [sourceEl.value, targetEl.value];
}
function updateLanguages() {
  for (const [id, select] of [
    ["source", sourceEl],
    ["target", targetEl],
  ]) {
    const [name, nativeName] = LANGUAGES[select.value];
    $(`${id}-name`).textContent =
      typeof languageName === "function" ? languageName(select.value) : name;
    $(`${id}-native`).textContent = nativeName;
    const flagImage = document.createElement("img");
    flagImage.src = languageFlag(select.value);
    flagImage.alt = "";
    flagImage.title = LANGUAGE_CATALOG[select.value]?.flagName || "";
    $(`${id}-flag`).replaceChildren(flagImage);
  }
  inputEl.lang = activeLanguages()[0] === "auto" ? "" : activeLanguages()[0];
  outputEl.lang = activeLanguages()[1];
  for (const [id, code] of [
    ["speaker-forward", sourceEl.value],
    ["speaker-reverse", targetEl.value],
  ]) {
    const flag = document.createElement("img");
    flag.src = languageFlag(code);
    flag.alt = "";
    flag.title = LANGUAGE_CATALOG[code]?.flagName || "";
    const name = document.createElement("span");
    name.textContent = typeof languageName === "function" ? languageName(code) : LANGUAGES[code][0];
    $(id).replaceChildren(flag, name);
  }
  for (const [id, selected] of [
    ["speaker-forward", !reverseSpeaker],
    ["speaker-reverse", reverseSpeaker],
  ]) {
    $(id).classList.toggle("selected", selected);
    $(id).setAttribute("aria-pressed", String(selected));
  }
  document.dispatchEvent(new CustomEvent("languages:change"));
}
for (const [code, [name, nativeName]] of Object.entries(LANGUAGES)) {
  sourceEl.add(new Option(`${name} · ${nativeName}`, code));
  if (code !== "auto") targetEl.add(new Option(`${name} · ${nativeName}`, code));
}
sourceEl.value = "th";
targetEl.value = "en";
updateLanguages();
updateInput();

async function translate({ refresh = false } = {}) {
  if (mode === "image") {
    document.dispatchEvent(new CustomEvent("photo:translate"));
    return;
  }
  cancelAutoTranslation();
  if (composing) return;
  const text = inputEl.value.trim();
  if (!text) {
    setStatus(t("empty"), true);
    inputEl.focus();
    return;
  }
  if (text.length > maxInput()) {
    setStatus(t("tooLong"), true);
    return;
  }
  const [source, target] = activeLanguages(),
    isChat = mode === "live",
    options = translationOptions(),
    tone = $("tone").value;
  if (isChat && (source === "auto" || target === "auto")) {
    setStatus(t("chooseSpeaker"), true);
    return;
  }
  if (isChat && source === target) {
    setStatus(t("sameChatLanguage"), true);
    return;
  }
  if (isChat) {
    // Only this language pair's latest complete messages; never another feature's history.
    options.conversation = conversation
      .filter(
        (turn) =>
          [source, target].includes(turn.source) &&
          [source, target].includes(turn.target) &&
          turn.text.length <= 1500 &&
          turn.translation.length <= 1500
      )
      .slice(-6)
      .map((turn) => ({
        source: turn.source,
        target: turn.target,
        text: turn.text,
        translation: turn.translation,
      }));
  }
  stopRecording(true);
  stopAudio();
  const controller = startOperation();
  translateBtn.disabled = true;
  if (isChat) $("live-send").disabled = true;
  document.querySelector(".output-panel").setAttribute("aria-busy", "true");
  setStatus(t("loading"));
  if (!isChat) document.dispatchEvent(new CustomEvent("translation:invalidated"));
  const started = performance.now();
  try {
    const data = await responseJson(
      await fetch("/api/translate", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, source, target, tone, ...options, cache_bypass: refresh }),
      })
    );
    if (!ownsOperation(controller)) return;
    if (data.interpretation?.status === "needs_context") {
      document.dispatchEvent(new CustomEvent("thai:result", { detail: data.interpretation }));
      setStatus(t("thaiNeedContext"));
      return;
    }
    if (data.quality_review?.status === "needs_context") {
      setStatus(`${t("meaningNeedsContext")} ${data.quality_review.question || ""}`, true);
      inputEl.focus();
      return;
    }
    const detail = {
      text,
      translation: data.translation,
      source,
      target,
      tone,
      ...options,
      additional_translations: data.additional_translations || [],
      audit: data.audit || null,
      sourceLanguage: data.source_language || source,
      feature: mode,
      interpretation: data.interpretation || null,
      quality_review: data.quality_review || null,
    };
    if (!isChat) commitTranslation(detail);
    else {
      outputEl.value = data.translation;
      updateOutput();
      setStatus(t("done"));
    }
    if (isChat) {
      const turn = { ...detail, reversed: reverseSpeaker };
      document.dispatchEvent(new CustomEvent("history:record", { detail }));
      conversation.push(turn);
      renderTurn(turn);
      inputEl.value = "";
      updateInput();
      if ($("auto-speak").checked) speak(data.translation, target);
    }
    setStatus(t("doneIn").replace("{seconds}", ((performance.now() - started) / 1000).toFixed(1)));
    if (["unavailable", "rejected", "length_limit"].includes(data.quality_review?.status))
      setStatus(t("meaningReviewUnavailable"));
    document.dispatchEvent(new CustomEvent("thai:result", { detail: data.interpretation || null }));
  } catch (error) {
    if (error.name !== "AbortError" && ownsOperation(controller))
      setStatus(error.message || t("failed"), true);
  } finally {
    if (ownsOperation(controller)) cancelOperation();
  }
}
translateBtn.addEventListener("click", translate);
inputEl.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    translate();
  }
});
inputEl.addEventListener("compositionstart", () => {
  composing = true;
  compositionOwner = { mode, epoch: modeEpoch };
  invalidateTranslation();
});
inputEl.addEventListener("compositionend", () => {
  if (!compositionOwner || compositionOwner.mode !== mode || compositionOwner.epoch !== modeEpoch)
    return;
  composing = false;
  compositionOwner = null;
  invalidateTranslation();
  updateInput();
  scheduleAutoTranslation();
});
inputEl.addEventListener("input", (event) => {
  stopAudio();
  invalidateTranslation();
  updateInput();
  if (!event.isComposing) scheduleAutoTranslation();
});
function removeFile() {
  activeFeature().documentFile = null;
  activeFeature().needsExtraction = false;
  selectedFilename = "";
  $("file-input").value = "";
  $("file-preview").hidden = true;
  $("retry-file").hidden = true;
  $("file-name").textContent = "";
  fileStatus();
}
function clearText() {
  stopRecording(true);
  stopAudio();
  inputEl.value = "";
  invalidateTranslation();
  removeFile();
  updateInput();
  inputEl.focus();
}
$("clear").addEventListener("click", clearText);
$("remove-file").addEventListener("click", clearText);
async function copyText(text) {
  const owner = mode,
    epoch = modeEpoch;
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    else {
      const temporary = document.createElement("textarea");
      temporary.value = text;
      temporary.style.position = "fixed";
      temporary.style.opacity = "0";
      document.body.append(temporary);
      temporary.select();
      const copied = document.execCommand("copy");
      temporary.remove();
      if (!copied) throw new Error("copy failed");
    }
    if (mode === owner && modeEpoch === epoch) setStatus(t("copied"));
    return true;
  } catch {
    if (mode === owner && modeEpoch === epoch) setStatus(t("copyFailed"), true);
    return false;
  }
}
$("copy").addEventListener("click", () => copyText(outputEl.value));
$("swap").addEventListener("click", () => {
  stopRecording(true);
  stopAudio();
  const source =
    sourceEl.value === "auto" ? currentTranslation?.sourceLanguage || "en" : sourceEl.value;
  sourceEl.value = targetEl.value;
  targetEl.value = source;
  reverseSpeaker = false;
  if (mode !== "live" && outputEl.value) inputEl.value = outputEl.value;
  invalidateTranslation();
  updateInput();
  updateLanguages();
  scheduleAutoTranslation();
});
for (const select of [sourceEl, targetEl, $("tone")])
  select.addEventListener("change", () => {
    stopRecording(true);
    stopAudio();
    reverseSpeaker = false;
    invalidateTranslation();
    updateLanguages();
    scheduleAutoTranslation();
  });

function refreshMode() {
  for (const option of sourceEl.options) {
    option.disabled =
      option.value === "auto"
        ? mode === "live"
        : mode === "image" && !LANGUAGE_CATALOG[option.value]?.ocr;
  }
  if (mode === "image" && !LANGUAGE_CATALOG[sourceEl.value]?.ocr) sourceEl.value = "auto";
  document.querySelector(".translator").classList.toggle("live-mode", mode === "live");
  document.querySelector(".translator").classList.toggle("image-mode", mode === "image");
  document.querySelector(".translator").classList.toggle("document-mode", mode === "document");
  $("photo-mode").hidden = mode !== "image";
  $("file-tools").hidden = mode !== "document";
  $("chat-area").hidden = mode !== "live";
  $("upload-title").textContent = t("chooseDocument");
  $("upload-hint").textContent = t("documentHint");
  $("microphone").disabled = mode === "image" || mode === "document";
  $("microphone").hidden = mode === "image" || mode === "document";
  $("show-saved").hidden = true;
  $("source-heading").textContent = t(mode === "live" ? "message" : "source");
  inputEl.placeholder = t(mode === "live" ? "chatPlaceholder" : "placeholder");
  translateBtn.querySelector("span").textContent = t(mode === "live" ? "send" : "translate");
  document.querySelectorAll("[data-mode]").forEach((button) => {
    const active = button.dataset.mode === mode;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  updateInput();
  updateLanguages();
  document.dispatchEvent(new CustomEvent("mode:change", { detail: mode }));
}
function switchFeature(nextMode) {
  if (nextMode === mode || !featureWorkspaces.has(nextMode)) return;
  const previous = mode,
    previousWorkspace = activeFeature(),
    wasBusy = !!previousWorkspace.request || previousWorkspace.timer !== null;
  stopRecording(true);
  stopAudio();
  cancelOperation();
  composing = false;
  compositionOwner = null;
  if (wasBusy) setStatus();
  previousWorkspace.view = {
    source: sourceEl.value,
    target: targetEl.value,
    tone: $("tone").value,
    input: inputEl.value,
    output: outputEl.value,
    outputLanguage: outputEl.lang,
    reverseSpeaker,
    filename: selectedFilename,
    fileStatus: $("file-status").textContent,
    fileError: $("file-status").classList.contains("error"),
    status: statusEl.textContent,
    statusError: statusEl.classList.contains("error"),
    scroll: window.scrollY,
  };
  document.dispatchEvent(new CustomEvent("mode:leaving", { detail: { previous, next: nextMode } }));
  for (const dialog of document.querySelectorAll("dialog[open]")) dialog.close();
  closeSettings();
  mode = nextMode;
  modeEpoch++;
  const view = activeFeature().view;
  sourceEl.value = view.source;
  targetEl.value = view.target;
  $("tone").value = view.tone;
  inputEl.value = view.input;
  outputEl.value = view.output;
  outputEl.lang = view.outputLanguage;
  reverseSpeaker = view.reverseSpeaker;
  selectedFilename = view.filename;
  $("file-input").value = "";
  $("file-name").textContent = selectedFilename;
  $("file-preview").hidden = !activeFeature().documentFile;
  $("retry-file").hidden = !activeFeature().needsExtraction;
  fileStatus(view.fileStatus, view.fileError);
  setStatus(view.status, view.statusError);
  voiceStatus();
  updateOutput();
  refreshMode();
  document.dispatchEvent(new CustomEvent("mode:restored", { detail: mode }));
  window.scrollTo({ top: view.scroll, behavior: "instant" });
}
for (const button of document.querySelectorAll("[data-mode]"))
  button.addEventListener("click", () => switchFeature(button.dataset.mode));
$("retry-file").addEventListener("click", () => {
  if (mode === "document" && activeFeature().documentFile) importFile(activeFeature().documentFile);
});
$("choose-file").addEventListener("click", () => $("file-input").click());
$("file-input").addEventListener("change", () => {
  const file = $("file-input").files[0];
  if (file) importFile(file);
  $("file-input").value = "";
});
for (const name of ["dragenter", "dragover"])
  $("choose-file").addEventListener(name, (event) => {
    event.preventDefault();
    $("choose-file").classList.add("dragover");
  });
for (const name of ["dragleave", "drop"])
  $("choose-file").addEventListener(name, (event) => {
    event.preventDefault();
    $("choose-file").classList.remove("dragover");
    if (name === "drop" && event.dataTransfer.files[0]) importFile(event.dataTransfer.files[0]);
  });
async function importFile(file) {
  if (mode !== "document") return;
  if (file.size > 10 * 1024 * 1024) {
    fileStatus(t("fileTooLarge"), true);
    return;
  }
  const allowed = /\.(txt|md|csv|pdf|docx)$/i;
  if (!allowed.test(file.name)) {
    fileStatus(t("fileUnsupported"), true);
    return;
  }
  stopRecording(true);
  stopAudio();
  invalidateTranslation();
  removeFile();
  activeFeature().documentFile = file;
  activeFeature().needsExtraction = true;
  selectedFilename = file.name;
  $("file-name").textContent = file.name;
  $("file-preview").hidden = false;
  inputEl.value = "";
  updateInput();
  const controller = startOperation();
  $("choose-file").disabled = true;
  $("retry-file").hidden = true;
  $("file-tools").setAttribute("aria-busy", "true");
  fileStatus(t("extracting"));
  const form = new FormData();
  form.append("file", file);
  form.append("kind", mode);
  try {
    const data = await responseJson(
      await fetch("/api/extract", { method: "POST", body: form, signal: controller.signal })
    );
    if (!ownsOperation(controller)) return;
    selectedFilename = file.name;
    $("file-name").textContent = file.name;
    $("file-preview").hidden = false;
    activeFeature().needsExtraction = false;
    $("retry-file").hidden = true;
    inputEl.value = data.text;
    updateInput();
    fileStatus(t("extracted"));
    cancelOperation();
    await translate();
  } catch (error) {
    if (error.name !== "AbortError" && ownsOperation(controller))
      fileStatus(error.message || t("failed"), true);
  } finally {
    if (ownsOperation(controller)) {
      cancelOperation();
      $("retry-file").hidden = !activeFeature().needsExtraction;
    }
  }
}

function renderTurn(turn) {
  $("chat-empty").hidden = true;
  const card = document.createElement("article");
  card.className = `chat-turn${turn.reversed ? " reversed" : ""}`;
  const title = document.createElement("span");
  title.className = "chat-direction";
  title.textContent = `${LANGUAGES[turn.source][0]} → ${LANGUAGES[turn.target][0]}`;
  const original = document.createElement("p");
  original.className = "original-message";
  original.textContent = turn.text;
  original.lang = turn.source;
  original.dir = "auto";
  const translated = document.createElement("p");
  translated.className = "translated-message";
  translated.textContent = turn.translation;
  translated.lang = turn.target;
  translated.dir = "auto";
  const actions = document.createElement("div");
  actions.className = "chat-turn-actions";
  const listen = document.createElement("button");
  listen.type = "button";
  listen.className = "speaker-button";
  listen.setAttribute("aria-label", `${LANGUAGES[turn.target][0]} · ${t("translation")}`);
  listen.innerHTML = '<svg aria-hidden="true"><use href="#icon-volume"/></svg>';
  listen.addEventListener("click", () => speak(turn.translation, turn.target, listen));
  const expand = document.createElement("button");
  expand.type = "button";
  expand.className = "speaker-button";
  expand.setAttribute("aria-label", t("expandMessage"));
  expand.innerHTML = '<svg aria-hidden="true"><use href="#icon-expand"/></svg>';
  expand.addEventListener("click", () =>
    document.dispatchEvent(new CustomEvent("chat:expand", { detail: turn }))
  );
  actions.append(title, expand, listen);
  card.append(translated, original);
  for (const result of turn.additional_translations || []) {
    const extra = document.createElement("p");
    extra.className = "chat-additional";
    extra.dir = "auto";
    extra.lang = result.target;
    extra.textContent = `${LANGUAGES[result.target][0]} · ${result.pending ? t("loading") : result.translation || result.error}`;
    card.append(extra);
    if (result.error || result.pending) {
      const retry = document.createElement("button");
      retry.type = "button";
      retry.className = "outline-button";
      retry.textContent = t(result.pending ? "loading" : "retry");
      retry.addEventListener("click", () =>
        document.dispatchEvent(
          new CustomEvent("chat:retry-additional", {
            detail: { turn, result, text: extra, button: retry },
          })
        )
      );
      card.append(retry);
      if (result.pending)
        queueMicrotask(() =>
          document.dispatchEvent(
            new CustomEvent("chat:retry-additional", {
              detail: { turn, result, text: extra, button: retry },
            })
          )
        );
    }
  }
  if (turn.audit?.status === "review") {
    const audit = document.createElement("details");
    audit.className = "chat-audit studio-back";
    const summary = document.createElement("summary");
    summary.textContent = t("consistencyReview").replace("{count}", turn.audit.issues.length);
    const content = document.createElement("div");
    renderAudit(content, turn.audit);
    audit.append(summary, content);
    card.append(audit);
  }
  card.append(actions);
  $("chat-messages").append(card);
  $("chat-messages").scrollTop = $("chat-messages").scrollHeight;
}
for (const [id, reverse] of [
  ["speaker-forward", false],
  ["speaker-reverse", true],
])
  $(id).addEventListener("click", () => {
    stopRecording(true);
    stopAudio();
    invalidateTranslation();
    reverseSpeaker = reverse;
    updateLanguages();
  });
$("clear-chat").addEventListener("click", () => {
  clearText();
  conversation.length = 0;
  $("chat-messages")
    .querySelectorAll(".chat-turn")
    .forEach((card) => card.remove());
  $("chat-empty").hidden = false;
});

function stopAudio() {
  audioEpoch++;
  audioController?.abort();
  audioController = null;
  if (audioPlayer) {
    audioPlayer.pause();
    audioPlayer.removeAttribute("src");
    audioPlayer.load();
    audioPlayer = null;
  }
  if (audioUrl) URL.revokeObjectURL(audioUrl);
  audioUrl = null;
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  audioButton?.setAttribute("aria-pressed", "false");
  audioButton = null;
  voiceStatus();
}
function installedSpeechVoice(language) {
  if (language === "auto" || !window.speechSynthesis) return null;
  const normalize = (value) => value.replaceAll("_", "-").toLowerCase(),
    requested = normalize(language),
    preferred = normalize(LANGUAGE_CATALOG[language]?.locale || language),
    base = preferred.split("-")[0],
    voices = window.speechSynthesis.getVoices();
  return (
    voices.find((voice) => normalize(voice.lang) === preferred) ||
    voices.find((voice) => normalize(voice.lang) === requested) ||
    voices.find((voice) => normalize(voice.lang).split("-")[0] === base) ||
    null
  );
}
async function waitForSpeechVoice(language, signal) {
  const ready = installedSpeechVoice(language);
  if (ready || language === "auto" || !window.speechSynthesis || signal.aborted) return ready;
  await new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      window.speechSynthesis.removeEventListener("voiceschanged", changed);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const changed = () => {
      if (installedSpeechVoice(language)) finish();
    };
    const timer = setTimeout(finish, 350);
    window.speechSynthesis.addEventListener("voiceschanged", changed);
    signal.addEventListener("abort", finish, { once: true });
    changed();
  });
  return installedSpeechVoice(language);
}
function playInstalledSpeech(text, voice, signal) {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve(false);
    const utterance = new SpeechSynthesisUtterance(text);
    const finish = (success = false) => {
      signal.removeEventListener("abort", canceled);
      utterance.onend = utterance.onerror = null;
      resolve(success);
    };
    const canceled = () => finish(false);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.onend = () => finish(true);
    utterance.onerror = () => finish(false);
    signal.addEventListener("abort", canceled, { once: true });
    voiceStatus(t("speechPlaying"));
    try {
      window.speechSynthesis.speak(utterance);
    } catch {
      finish(false);
    }
  });
}
async function speak(text, language, button = null) {
  if (!text.trim()) return;
  const wasPlaying = button && audioButton === button;
  stopAudio();
  if (wasPlaying) return;
  stopRecording(true);
  const epoch = audioEpoch,
    controller = new AbortController();
  audioController = controller;
  audioButton = button;
  button?.setAttribute("aria-pressed", "true");
  voiceStatus(t("speechLoading"));
  const voice = await waitForSpeechVoice(language, controller.signal);
  if (epoch !== audioEpoch) return;
  if (voice) {
    const played = await playInstalledSpeech(text, voice, controller.signal);
    if (epoch !== audioEpoch) return;
    if (played) {
      stopAudio();
      return;
    }
    voiceStatus(t("speechLoading"));
  }
  if (!LANGUAGE_CATALOG[language]?.voice && language !== "auto") {
    stopAudio();
    voiceStatus(t("voiceUnavailable"), true);
    return;
  }
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 45000);
  try {
    const response = await fetch("/api/speech", {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, language }),
    });
    if (!response.ok) await responseJson(response);
    const blob = await response.blob();
    if (epoch !== audioEpoch) return;
    if (!blob.size) throw new Error(t("speechError"));
    audioUrl = URL.createObjectURL(blob);
    audioPlayer = new Audio(audioUrl);
    audioPlayer.onended = () => {
      if (epoch === audioEpoch) stopAudio();
    };
    audioPlayer.onerror = () => {
      if (epoch === audioEpoch) {
        stopAudio();
        voiceStatus(t("speechError"), true);
      }
    };
    await audioPlayer.play();
    if (epoch === audioEpoch) voiceStatus(t("speechPlaying"));
  } catch (error) {
    if (epoch !== audioEpoch || (error.name === "AbortError" && !timedOut)) return;
    // A device voice may have become available while the server request was in flight.
    const fallback = installedSpeechVoice(language);
    if (!timedOut && fallback && fallback !== voice) {
      const played = await playInstalledSpeech(text, fallback, controller.signal);
      if (epoch !== audioEpoch) return;
      if (played) {
        stopAudio();
        return;
      }
    }
    stopAudio();
    voiceStatus(error.message || t("speechError"), true);
  } finally {
    clearTimeout(timeout);
  }
}
$("speak-source").addEventListener("click", () =>
  speak(inputEl.value, activeLanguages()[0], $("speak-source"))
);
$("speak-output").addEventListener("click", () =>
  speak(outputEl.value, activeLanguages()[1], $("speak-output"))
);

function microphoneVocabulary(language) {
  if (language === "auto") return [];
  const workspace = activeFeature(),
    forward = language === sourceEl.value,
    terms = workspace.glossary
      .filter((entry) => entry.language === (forward ? targetEl.value : language))
      .map((entry) => (forward ? entry.source : entry.target));
  if (language === "th") terms.push(...workspace.thai.lexicon.map((entry) => entry.term));
  const selected = [];
  for (const term of new Set(terms)) {
    if (selected.length >= 16) break;
    if (new TextEncoder().encode([...selected, term].join(", ")).length <= 200) selected.push(term);
  }
  return selected;
}
function setMicrophoneState(state, stream = null, onLevel = null) {
  $("microphone").dataset.voiceState = state;
  document.dispatchEvent(
    new CustomEvent("voice:state", { detail: { state, stream, reversed: reverseSpeaker, onLevel } })
  );
}
function releaseMicrophone() {
  clearTimeout(recordTimer);
  recordTimer = null;
  mediaStream?.getTracks().forEach((track) => track.stop());
  mediaStream = null;
  $("microphone").setAttribute("aria-pressed", "false");
  setMicrophoneState("idle");
}
function stopRecording(discard = false) {
  if (discard) {
    recordingEpoch++;
    micStarting = false;
  }
  if (recorder && recorder.state !== "inactive") recorder.stop();
  recorder = null;
  releaseMicrophone();
  if (discard) voiceStatus();
}
$("microphone").addEventListener("click", async () => {
  if (mode === "image" || mode === "document") return;
  if (recorder?.state === "recording") {
    stopRecording();
    return;
  }
  if (micStarting) return;
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    voiceStatus(t("micUnsupported"), true);
    return;
  }
  if (activeLanguages()[0] !== "auto" && !LANGUAGE_CATALOG[activeLanguages()[0]]?.transcribe) {
    voiceStatus(t("microphoneUnavailable"), true);
    return;
  }
  stopAudio();
  cancelOperation();
  setStatus();
  micStarting = true;
  setMicrophoneState("requesting");
  const epoch = ++recordingEpoch;
  const [language] = activeLanguages(),
    vocabulary = microphoneVocabulary(language);
  const live = mode === "live";
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: { ideal: 1 },
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    if (epoch !== recordingEpoch) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    mediaStream = stream;
    const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"].find((type) =>
      MediaRecorder.isTypeSupported(type)
    );
    const recording = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: 128000,
      }),
      parts = [],
      signal = { samples: 0, peak: 0 };
    recorder = recording;
    recording.ondataavailable = (event) => {
      if (event.data.size) parts.push(event.data);
    };
    recording.onerror = () => {
      stopRecording(true);
      voiceStatus(t("micError"), true);
    };
    recording.onstop = async () => {
      if (epoch !== recordingEpoch) return;
      releaseMicrophone();
      const blob = new Blob(parts, { type: recording.mimeType });
      if (!blob.size || (signal.samples >= 5 && signal.peak < 0.00001)) {
        voiceStatus(t("noSpeech"), true);
        return;
      }
      const controller = startOperation();
      setMicrophoneState("transcribing");
      voiceStatus(t("transcribing"));
      const form = new FormData(),
        extension = recording.mimeType.includes("mp4")
          ? "mp4"
          : recording.mimeType.includes("ogg")
            ? "ogg"
            : "webm";
      form.append("file", blob, `recording.${extension}`);
      form.append("language", language);
      if (live) form.append("verify", "1");
      if (vocabulary.length) form.append("vocabulary", JSON.stringify(vocabulary));
      try {
        const data = await responseJson(
          await fetch("/api/transcribe", { method: "POST", body: form, signal: controller.signal })
        );
        if (!ownsOperation(controller) || epoch !== recordingEpoch) return;
        const text = `${inputEl.value}${inputEl.value ? " " : ""}${data.text}`;
        if (text.length > maxInput()) throw new Error(t("tooLong"));
        inputEl.value = text;
        invalidateTranslation();
        updateInput();
        voiceStatus();
        if (data.review_required || (live && activeFeature().voiceReview === true)) {
          const verificationOnly =
            data.review_reasons?.length === 1 &&
            data.review_reasons[0] === "verification_unavailable";
          voiceStatus(
            t(data.review_required && !verificationOnly ? "voiceUncertain" : "voiceReview")
          );
          inputEl.focus();
          return;
        }
        if (
          ["text", "live"].includes(mode) &&
          ["th", "auto"].includes(language) &&
          activeFeature().thai.mode !== "standard"
        ) {
          voiceStatus(t("thaiReviewTranscript"));
          inputEl.focus();
          return;
        }
        if (live) await translate();
        else {
          inputEl.focus();
          scheduleAutoTranslation();
        }
      } catch (error) {
        if (error.name !== "AbortError" && ownsOperation(controller))
          voiceStatus(error.message || t("failed"), true);
      } finally {
        if (ownsOperation(controller)) cancelOperation();
      }
    };
    recording.start();
    $("microphone").setAttribute("aria-pressed", "true");
    setMicrophoneState("recording", stream, (rms) => {
      signal.samples++;
      signal.peak = Math.max(signal.peak, rms);
    });
    voiceStatus(t("recording"));
    recordTimer = setTimeout(() => stopRecording(), 60000);
  } catch {
    releaseMicrophone();
    if (epoch === recordingEpoch) voiceStatus(t("micError"), true);
  } finally {
    if (epoch === recordingEpoch) micStarting = false;
  }
});
window.addEventListener("pagehide", () => {
  document.dispatchEvent(new CustomEvent("translation:invalidated"));
  stopRecording(true);
  stopAudio();
  cancelOperation();
});

function updateThemeLabel() {
  const light = document.documentElement.dataset.theme === "light",
    label = t(light ? "darkTheme" : "lightTheme");
  $("theme").setAttribute("aria-label", label);
  $("theme").title = label;
  $("theme").setAttribute("aria-pressed", String(light));
  document.querySelector('meta[name="theme-color"]').content = light ? "#f6f3ed" : "#211f1b";
}
try {
  const savedTheme = localStorage.getItem("translator-theme");
  if (savedTheme === "light") document.documentElement.dataset.theme = "light";
} catch {
  /* Optional preference storage. */
}
updateThemeLabel();
let themeTransitionTimer = null;
requestAnimationFrame(() =>
  requestAnimationFrame(() => document.documentElement.classList.add("theme-ready"))
);
$("theme").addEventListener("click", () => {
  clearTimeout(themeTransitionTimer);
  document.documentElement.classList.add("theme-changing");
  $("theme").classList.remove("theme-switching");
  // Restart the small button animation on every click, including quick toggles.
  void $("theme").offsetWidth;
  $("theme").classList.add("theme-switching");
  const theme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem("translator-theme", theme);
  } catch {
    /* Theme works without storage. */
  }
  updateThemeLabel();
  themeTransitionTimer = setTimeout(() => {
    document.documentElement.classList.remove("theme-changing");
    $("theme").classList.remove("theme-switching");
  }, 500);
});
function applyInterfaceLocale(language) {
  locale = language;
  document.documentElement.lang = locale;
  document.documentElement.dir = LANGUAGE_CATALOG[locale]?.rtl ? "rtl" : "ltr";
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  updateThemeLabel();
  refreshMode();
  if (!activeFeature().request) setStatus();
  document.dispatchEvent(new CustomEvent("interface:change"));
}
function closeSettings() {
  if ($("settings").open) $("settings").close();
  $("settings-toggle").setAttribute("aria-expanded", "false");
}
$("settings-toggle").addEventListener("click", () => {
  if ($("settings").open) {
    closeSettings();
    return;
  }
  $("settings").showModal();
  $("settings-toggle").setAttribute("aria-expanded", "true");
  document.dispatchEvent(new CustomEvent("menu:open"));
});
$("menu-close").addEventListener("click", closeSettings);
$("settings").addEventListener("cancel", (event) => {
  event.preventDefault();
  closeSettings();
});
$("settings").addEventListener("close", () =>
  $("settings-toggle").setAttribute("aria-expanded", "false")
);
$("settings").addEventListener("click", (event) => {
  if (event.target !== $("settings")) return;
  const box = $("settings").getBoundingClientRect();
  if (
    event.clientX < box.left ||
    event.clientX > box.right ||
    event.clientY < box.top ||
    event.clientY > box.bottom
  )
    closeSettings();
});
document.addEventListener("translation:settings", () => {
  stopRecording(true);
  stopAudio();
  invalidateTranslation();
  scheduleAutoTranslation();
});
refreshMode();
