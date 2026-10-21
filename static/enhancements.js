/* Contextual tools are isolated from the main text/file/voice request lifecycle. */
Object.assign(COPY.en, {
  why: "Why this?",
  checkTranslation: "Check translation",
  explanation: "Translation explanation",
  aiReview: "AI review",
  reviewGood: "AI review · Meaning preserved",
  reviewChanges: "AI review · Suggested changes",
  applyRevision: "Use suggested translation",
  reply: "Reply",
  replySubtitle: "Translate a reply · Suggestions",
  suggestReplies: "Suggest 3 replies",
  yourReply: "Your reply",
  translateReply: "Translate reply",
  replyPlaceholder: "Type your reply...",
  savedTranslations: "Saved translations",
  savedNote: "Saved on this browser.",
  noSaved: "No saved translations yet. Tap the star on a translation to save it.",
  saved: "Translation saved",
  unsaved: "Translation removed from saved",
  saveFailed: "Could not save. Browser storage may be full or unavailable.",
  openSaved: "Open",
  deleteSaved: "Remove",
  working: "Thinking…",
  sourceInfoLoading: "Preparing pronunciation and examples…",
  sourceInfoFailed: "Could not load pronunciation and examples.",
  retry: "Retry",
  replyEmpty: "Type or choose a reply first.",
  saveLimit: "You can save up to 100 translations. Remove an older one first.",
});
Object.assign(COPY.th, {
  why: "ทำไมแปลแบบนี้?",
  checkTranslation: "ตรวจคำแปล",
  explanation: "อธิบายคำแปล",
  aiReview: "ตรวจทานโดย AI",
  reviewGood: "AI ตรวจทาน · ความหมายตรงกัน",
  reviewChanges: "AI ตรวจทาน · มีข้อเสนอแนะ",
  applyRevision: "ใช้คำแปลที่เสนอ",
  reply: "ตอบกลับ",
  replySubtitle: "แปลคำตอบ · ข้อเสนอแนะ",
  suggestReplies: "แนะนำ 3 คำตอบ",
  yourReply: "คำตอบของคุณ",
  translateReply: "แปลคำตอบ",
  replyPlaceholder: "พิมพ์คำตอบของคุณ...",
  savedTranslations: "คำแปลที่บันทึกไว้",
  savedNote: "บันทึกไว้ในเบราว์เซอร์นี้",
  noSaved: "ยังไม่มีคำแปลที่บันทึกไว้ กดดาวที่คำแปลเพื่อบันทึก",
  saved: "บันทึกคำแปลแล้ว",
  unsaved: "นำคำแปลออกจากรายการบันทึกแล้ว",
  saveFailed: "บันทึกไม่ได้ พื้นที่เบราว์เซอร์อาจเต็มหรือไม่อนุญาตให้บันทึก",
  openSaved: "เปิด",
  deleteSaved: "นำออก",
  working: "กำลังประมวลผล…",
  sourceInfoLoading: "กำลังเตรียมคำอ่านและตัวอย่าง…",
  sourceInfoFailed: "โหลดคำอ่านและตัวอย่างไม่สำเร็จ",
  retry: "ลองใหม่",
  replyEmpty: "กรุณาพิมพ์หรือเลือกคำตอบก่อน",
  saveLimit: "บันทึกได้สูงสุด 100 คำแปล กรุณานำรายการเก่าออกก่อน",
});
let currentTranslation = null,
  featureRevision = 0,
  suggestedRevision = "",
  translatedReply = "";
const assistantRequests = () => activeFeature().assistantRequests;
const sourceCache = () => activeFeature().sourceInfoCache;
const SAVED_KEY = "translator-history-v2";
const LEGACY_SAVED_KEY = "translator-saved-v1";
const isString = (value) => typeof value === "string";
const validLanguage = (code) => isString(code) && Object.hasOwn(LANGUAGES, code);
function readSaved() {
  try {
    const records = JSON.parse(
      localStorage.getItem(SAVED_KEY) || localStorage.getItem(LEGACY_SAVED_KEY) || "[]"
    );
    const valid = Array.isArray(records)
      ? records
          .filter(
            (item) =>
              item &&
              isString(item.text) &&
              item.text.length <= 30000 &&
              isString(item.translation) &&
              item.translation.length <= 90000 &&
              validLanguage(item.source) &&
              validLanguage(item.target) &&
              item.target !== "auto" &&
              (item.sourceLanguage === undefined ||
                (validLanguage(item.sourceLanguage) && item.sourceLanguage !== "auto")) &&
              ["natural", "formal", "casual", "friendly"].includes(item.tone)
          )
          .map((item) => ({
            ...item,
            favorite: item.favorite !== false,
            feature: ["text", "document", "image", "live"].includes(item.feature)
              ? item.feature
              : item.text.length > 5000
                ? "document"
                : "text",
          }))
      : [];
    const counts = { text: 0, document: 0, image: 0, live: 0 };
    return valid.filter((item) => ++counts[item.feature] <= 100);
  } catch {
    return [];
  }
}
let savedTranslations = readSaved();
function savedId(item) {
  return JSON.stringify([
    item.feature || "text",
    item.text,
    item.translation,
    item.source,
    item.target,
    item.tone,
    item.context || "general",
    item.extra_context || "",
  ]);
}
function persistSaved(records) {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(records));
    savedTranslations = records;
    document.dispatchEvent(new CustomEvent("history:change"));
    return true;
  } catch {
    setStatus(t("saveFailed"), true);
    return false;
  }
}
function abortFeature(name) {
  assistantRequests().get(name)?.abort();
  assistantRequests().delete(name);
}
function resizeOutput() {
  outputEl.style.height = "auto";
  outputEl.style.height = `${Math.min(420, Math.max(65, outputEl.scrollHeight))}px`;
}
function resetFeatures() {
  featureRevision++;
  assistantRequests().forEach((controller) => controller.abort());
  assistantRequests().clear();
  currentTranslation = null;
  suggestedRevision = "";
  translatedReply = "";
  for (const id of [
    "source-insights",
    "translation-tools",
    "output-language",
    "reply-section",
    "explanation-panel",
    "check-panel",
    "apply-revision",
    "check-revision",
    "reply-result",
  ])
    $(id).hidden = true;
  for (const id of ["source-info-status", "explanation-text", "check-text", "reply-status"]) {
    $(id).textContent = "";
    $(id).classList.remove("error");
  }
  $("source-alternatives").replaceChildren();
  $("reply-suggestions").replaceChildren();
  for (const id of ["explain", "check-translation", "suggest-replies", "translate-reply"])
    $(id).disabled = false;
  $("explain").setAttribute("aria-expanded", "false");
  $("check-translation").setAttribute("aria-expanded", "false");
  $("reply-input").value = "";
  $("reply-output").textContent = "";
  $("check-revision").textContent = "";
  $("pronunciation").textContent = "";
  resizeOutput();
}
function featureStatus(id, message = "", error = false) {
  $(id).textContent = message;
  $(id).classList.toggle("error", error);
}
async function requestAssistant(action, statusId, button = null) {
  if (!currentTranslation) return null;
  abortFeature(action);
  const controller = new AbortController(),
    revision = featureRevision,
    snapshot = currentTranslation;
  assistantRequests().set(action, controller);
  if (button) button.disabled = true;
  featureStatus(statusId, t(action === "source_info" ? "sourceInfoLoading" : "working"));
  try {
    const data = await responseJson(
      await fetch("/api/assist", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...snapshot, action, interface_language: locale }),
      })
    );
    if (featureRevision !== revision || assistantRequests().get(action) !== controller) return null;
    featureStatus(statusId);
    return data;
  } catch (error) {
    if (
      error.name !== "AbortError" &&
      featureRevision === revision &&
      assistantRequests().get(action) === controller
    )
      featureStatus(statusId, error.message || t("failed"), true);
    return null;
  } finally {
    if (assistantRequests().get(action) === controller) {
      assistantRequests().delete(action);
      if (button) button.disabled = false;
    }
  }
}
function renderSourceInfo(data) {
  if (!currentTranslation) return;
  if (LANGUAGES[data.source_language] && data.source_language !== "auto")
    currentTranslation.sourceLanguage = data.source_language;
  $("pronunciation").textContent = data.pronunciation;
  $("pronunciation").hidden = !data.pronunciation;
  $("source-alternatives").replaceChildren();
  for (const text of data.alternatives) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "suggestion-chip";
    button.textContent = text;
    button.addEventListener("click", () => {
      inputEl.value = text;
      inputEl.dispatchEvent(new Event("input", { bubbles: true }));
      inputEl.focus();
    });
    $("source-alternatives").append(button);
  }
  $("source-insights").hidden = false;
  refreshFeatureLabels();
}
async function loadSourceInfo() {
  if (!currentTranslation || currentTranslation.text.length > 1500) return;
  const key = JSON.stringify([
    currentTranslation.text,
    currentTranslation.source,
    currentTranslation.target,
    currentTranslation.tone,
    currentTranslation.context,
    currentTranslation.extra_context,
    currentTranslation.glossary,
    locale,
  ]);
  if (sourceCache().has(key)) {
    renderSourceInfo(sourceCache().get(key));
    return;
  }
  const revision = featureRevision;
  const data = await requestAssistant("source_info", "source-info-status");
  if (revision !== featureRevision) return;
  if (data) {
    if (sourceCache().size >= 20) sourceCache().delete(sourceCache().keys().next().value);
    sourceCache().set(key, data);
    renderSourceInfo(data);
  } else if (currentTranslation && $("source-info-status").classList.contains("error")) {
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "text-button";
    retry.textContent = t("retry");
    retry.addEventListener("click", loadSourceInfo, { once: true });
    $("source-info-status").append(" ", retry);
  }
}
function effectiveSource() {
  return currentTranslation?.sourceLanguage && currentTranslation.sourceLanguage !== "auto"
    ? currentTranslation.sourceLanguage
    : currentTranslation?.source;
}
function updateSavedButton() {
  const saved =
    currentTranslation &&
    savedTranslations.some(
      (item) => item.favorite !== false && savedId(item) === savedId(currentTranslation)
    );
  $("save-translation").setAttribute("aria-pressed", String(!!saved));
  const label =
    locale === "th"
      ? saved
        ? "นำคำแปลออกจากรายการบันทึก"
        : "บันทึกคำแปล"
      : saved
        ? "Unsave translation"
        : "Save translation";
  $("save-translation").setAttribute("aria-label", label);
  $("save-translation").title = label;
}
function refreshFeatureLabels() {
  updateSavedButton();
  $("reply-input").placeholder = t("replyPlaceholder");
  const labels = {
    copy: locale === "th" ? "คัดลอกคำแปล" : "Copy translation",
    regenerate: locale === "th" ? "แปลใหม่" : "Translate again",
    "speak-output": locale === "th" ? "ฟังคำแปล" : "Listen to translation",
  };
  for (const [id, label] of Object.entries(labels)) {
    $(id).setAttribute("aria-label", label);
    $(id).title = label;
  }
  if (!currentTranslation) return;
  const source = effectiveSource(),
    target = currentTranslation.target;
  $("output-language").textContent = LANGUAGES[target][0];
  $("reply-instructions").textContent =
    locale === "th"
      ? `เขียนคำตอบเป็น${LANGUAGES[target][1]} แล้วแปลกลับเป็น${LANGUAGES[source][1]}`
      : `Write your reply in ${LANGUAGES[target][0]} and get it in ${LANGUAGES[source][0]}.`;
  $("reply-input").lang = target;
  $("reply-output").lang = source;
  $("reply-language").textContent = LANGUAGES[source][0];
}
document.addEventListener("translation:invalidated", resetFeatures);
document.addEventListener("translation:complete", (event) => {
  resetFeatures();
  currentTranslation = { ...event.detail, feature: mode };
  for (const id of ["translation-tools", "output-language", "reply-section"]) $(id).hidden = false;
  refreshFeatureLabels();
  resizeOutput();
  loadSourceInfo();
});
$("regenerate").addEventListener("click", translate);
$("explain").addEventListener("click", async () => {
  const panel = $("explanation-panel");
  if ($("explanation-text").textContent && !$("explanation-text").classList.contains("error")) {
    panel.hidden = !panel.hidden;
    $("explain").setAttribute("aria-expanded", String(!panel.hidden));
    return;
  }
  panel.hidden = false;
  $("explain").setAttribute("aria-expanded", "true");
  const data = await requestAssistant("explain", "explanation-text", $("explain"));
  if (data) $("explanation-text").textContent = data.explanation;
});
$("check-translation").addEventListener("click", async () => {
  $("check-panel").hidden = false;
  $("check-translation").setAttribute("aria-expanded", "true");
  $("apply-revision").hidden = true;
  $("check-revision").hidden = true;
  $("check-heading").textContent = t("aiReview");
  const data = await requestAssistant("check", "check-text", $("check-translation"));
  if (!data) return;
  $("check-heading").textContent = t(data.assessment === "good" ? "reviewGood" : "reviewChanges");
  $("check-text").textContent = data.notes;
  suggestedRevision = data.revision;
  if (data.assessment === "needs_revision" && suggestedRevision) {
    $("check-revision").textContent = suggestedRevision;
    $("check-revision").lang = currentTranslation.target;
    $("check-revision").hidden = false;
    $("apply-revision").hidden = false;
  }
});
$("apply-revision").addEventListener("click", () => {
  if (currentTranslation && suggestedRevision) applyStudioWording(suggestedRevision);
});
$("suggest-replies").addEventListener("click", async () => {
  const data = await requestAssistant("replies", "reply-status", $("suggest-replies"));
  if (!data) return;
  $("reply-suggestions").replaceChildren();
  for (const text of data.replies) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "suggestion-chip";
    button.textContent = text;
    button.lang = currentTranslation.target;
    button.addEventListener("click", () => {
      $("reply-input").value = text;
      $("reply-input").dispatchEvent(new Event("input"));
      $("reply-input").focus();
    });
    $("reply-suggestions").append(button);
  }
});
function invalidateReply() {
  abortFeature("reply");
  translatedReply = "";
  $("reply-result").hidden = true;
  $("translate-reply").disabled = false;
  featureStatus("reply-status");
}
$("reply-input").addEventListener("input", invalidateReply);
$("translate-reply").addEventListener("click", async () => {
  const text = $("reply-input").value.trim();
  if (!text) {
    featureStatus("reply-status", t("replyEmpty"), true);
    $("reply-input").focus();
    return;
  }
  if (!currentTranslation) return;
  const source = currentTranslation.target,
    target = effectiveSource();
  if (target === "auto") {
    featureStatus("reply-status", t("chooseSpeaker"), true);
    return;
  }
  invalidateReply();
  const controller = new AbortController(),
    revision = featureRevision;
  assistantRequests().set("reply", controller);
  $("translate-reply").disabled = true;
  featureStatus("reply-status", t("loading"));
  try {
    const data = await responseJson(
      await fetch("/api/translate", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          source,
          target,
          tone: currentTranslation.tone,
          context: currentTranslation.context || "general",
          extra_context: currentTranslation.extra_context || "",
          glossary: currentTranslation.glossary || [],
        }),
      })
    );
    if (featureRevision !== revision || assistantRequests().get("reply") !== controller) return;
    translatedReply = data.translation;
    $("reply-output").textContent = translatedReply;
    $("reply-result").hidden = false;
    featureStatus("reply-status", t("done"));
  } catch (error) {
    if (
      error.name !== "AbortError" &&
      featureRevision === revision &&
      assistantRequests().get("reply") === controller
    )
      featureStatus("reply-status", error.message || t("failed"), true);
  } finally {
    if (assistantRequests().get("reply") === controller) {
      assistantRequests().delete("reply");
      $("translate-reply").disabled = false;
    }
  }
});
$("reply-input").addEventListener("keydown", (event) => {
  if (!event.isComposing && (event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    $("translate-reply").click();
  }
});
$("copy-reply").addEventListener("click", () => {
  if (translatedReply) copyText(translatedReply);
});
$("speak-reply").addEventListener("click", () => {
  if (translatedReply) speak(translatedReply, effectiveSource(), $("speak-reply"));
});
function rememberTranslation(detail) {
  if (!detail.text || !detail.translation) return;
  const id = savedId(detail),
    previous = savedTranslations.find((item) => savedId(item) === id);
  const record = {
    ...detail,
    feature: detail.feature || mode,
    favorite: previous?.favorite || false,
    savedAt: Date.now(),
  };
  delete record.additional_translations;
  delete record.additional_targets;
  const records = [record, ...savedTranslations.filter((item) => savedId(item) !== id)];
  const own = records.filter((item) => item.feature === record.feature);
  if (own.length > 100) {
    const remove = [...own].reverse().find((item) => !item.favorite);
    if (remove) records.splice(records.indexOf(remove), 1);
  }
  persistSaved(records);
  updateSavedButton();
}
$("save-translation").addEventListener("click", () => {
  if (!currentTranslation) return;
  const id = savedId(currentTranslation),
    existing = savedTranslations.find((item) => savedId(item) === id);
  const favorite = !existing?.favorite;
  if (!existing && savedTranslations.filter((item) => item.feature === mode).length >= 100) {
    setStatus(t("saveLimit"), true);
    return;
  }
  const records = existing
    ? savedTranslations.map((item) => (savedId(item) === id ? { ...item, favorite } : item))
    : [{ ...currentTranslation, favorite: true, savedAt: Date.now() }, ...savedTranslations];
  if (persistSaved(records)) {
    updateSavedButton();
    setStatus(t(favorite ? "saved" : "unsaved"));
  }
});
function renderSaved() {
  $("saved-list").replaceChildren();
  const visibleSaved = savedTranslations.filter(
    (item) => (item.feature || "text") === mode && item.favorite !== false
  );
  if (!visibleSaved.length) {
    const empty = document.createElement("p");
    empty.textContent = t("noSaved");
    $("saved-list").append(empty);
  }
  for (const item of visibleSaved) {
    const card = document.createElement("article");
    card.className = "saved-card";
    const heading = document.createElement("h3");
    heading.textContent = `${LANGUAGES[item.source][0]} → ${LANGUAGES[item.target][0]}`;
    const original = document.createElement("p");
    original.className = "saved-original";
    original.textContent = item.text;
    const result = document.createElement("p");
    result.textContent = item.translation;
    result.lang = item.target;
    const actions = document.createElement("div");
    actions.className = "saved-actions";
    const open = document.createElement("button");
    open.type = "button";
    open.className = "outline-button";
    open.textContent = t("openSaved");
    open.addEventListener("click", () => {
      stopRecording(true);
      stopAudio();
      const nextMode = item.feature || "text";
      document.querySelector(`[data-mode="${nextMode}"]`).click();
      invalidateTranslation();
      removeFile();
      sourceEl.value = item.source;
      targetEl.value = item.target;
      $("tone").value = item.tone;
      inputEl.value = item.text;
      updateInput();
      updateLanguages();
      commitTranslation(item);
      $("saved-dialog").close();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "text-button";
    remove.textContent = t("deleteSaved");
    remove.addEventListener("click", () => {
      if (persistSaved(savedTranslations.filter((record) => savedId(record) !== savedId(item)))) {
        renderSaved();
        updateSavedButton();
      }
    });
    actions.append(open, remove);
    card.append(heading, original, result, actions);
    $("saved-list").append(card);
  }
}
$("show-saved").addEventListener("click", () => {
  renderSaved();
  closeSettings();
  $("saved-dialog").showModal();
});
$("close-saved").addEventListener("click", () => $("saved-dialog").close());
document.addEventListener("interface:change", () => {
  for (const name of ["explain", "check", "replies"]) abortFeature(name);
  for (const id of ["explain", "check-translation", "suggest-replies"]) $(id).disabled = false;
  $("explanation-panel").hidden = true;
  $("check-panel").hidden = true;
  $("explanation-text").textContent = "";
  $("check-text").textContent = "";
  $("explain").setAttribute("aria-expanded", "false");
  $("check-translation").setAttribute("aria-expanded", "false");
  featureStatus("reply-status");
  refreshFeatureLabels();
  renderSaved();
});
refreshFeatureLabels();
updateInput();
resizeOutput();

const assistantHiddenIds = [
  "source-insights",
  "translation-tools",
  "output-language",
  "reply-section",
  "explanation-panel",
  "check-panel",
  "apply-revision",
  "check-revision",
  "reply-result",
  "pronunciation",
];
const assistantTextIds = [
  "pronunciation",
  "explanation-text",
  "check-text",
  "check-heading",
  "check-revision",
  "reply-output",
  "source-info-status",
  "reply-status",
];
document.addEventListener("mode:leaving", () => {
  if (assistantRequests().has("source_info")) featureStatus("source-info-status");
  if (assistantRequests().has("reply") || assistantRequests().has("replies"))
    featureStatus("reply-status");
  for (const [name, id] of [
    ["explain", "explanation-text"],
    ["check", "check-text"],
  ])
    if (assistantRequests().has(name)) {
      $(id).textContent = "";
      $(name === "explain" ? "explanation-panel" : "check-panel").hidden = true;
    }
  activeFeature().assistant = {
    translation: currentTranslation,
    suggestedRevision,
    translatedReply,
    replyInput: $("reply-input").value,
    hidden: Object.fromEntries(assistantHiddenIds.map((id) => [id, $(id).hidden])),
    text: Object.fromEntries(
      assistantTextIds.map((id) => [
        id,
        { text: $(id).textContent, error: $(id).classList.contains("error") },
      ])
    ),
    sourceChips: [...$("source-alternatives").children],
    replyChips: [...$("reply-suggestions").children],
    explainExpanded: $("explain").getAttribute("aria-expanded"),
    checkExpanded: $("check-translation").getAttribute("aria-expanded"),
  };
  resetFeatures();
});
document.addEventListener("mode:restored", () => {
  const saved = activeFeature().assistant;
  if (!saved) {
    resetFeatures();
    refreshFeatureLabels();
    return;
  }
  currentTranslation = saved.translation;
  suggestedRevision = saved.suggestedRevision;
  translatedReply = saved.translatedReply;
  $("reply-input").value = saved.replyInput;
  for (const [id, hidden] of Object.entries(saved.hidden)) $(id).hidden = hidden;
  for (const [id, value] of Object.entries(saved.text)) {
    $(id).textContent = value.text;
    $(id).classList.toggle("error", value.error);
  }
  $("source-alternatives").replaceChildren(...saved.sourceChips);
  $("reply-suggestions").replaceChildren(...saved.replyChips);
  $("explain").setAttribute("aria-expanded", saved.explainExpanded);
  $("check-translation").setAttribute("aria-expanded", saved.checkExpanded);
  refreshFeatureLabels();
  resizeOutput();
});
