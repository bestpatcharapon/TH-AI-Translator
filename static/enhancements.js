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
  sourceInfoLoading: "Preparing examples…",
  sourceInfoFailed: "Could not load examples.",
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
  sourceInfoLoading: "กำลังเตรียมตัวอย่าง…",
  sourceInfoFailed: "โหลดตัวอย่างไม่สำเร็จ",
  retry: "ลองใหม่",
  replyEmpty: "กรุณาพิมพ์หรือเลือกคำตอบก่อน",
  saveLimit: "บันทึกได้สูงสุด 100 คำแปล กรุณานำรายการเก่าออกก่อน",
});
let currentTranslation = null,
  featureRevision = 0,
  suggestedRevision = "",
  replySuggestions = null,
  replyEditState = null;
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
              ["standard", "natural", "formal", "casual", "friendly", "business"].includes(
                item.tone
              )
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
  closeReplyEditor();
  clearTimeout(activeFeature().sourceInfoTimer);
  activeFeature().sourceInfoTimer = null;
  assistantRequests().forEach((controller) => controller.abort());
  assistantRequests().clear();
  currentTranslation = null;
  suggestedRevision = "";
  replySuggestions = null;
  $("reply-suggestions").replaceChildren();
  $("reply-suggestions").hidden = true;
  $("suggest-replies").setAttribute("aria-expanded", "false");
  for (const id of [
    "source-insights",
    "translation-tools",
    "output-language",
    "explanation-panel",
    "check-panel",
    "apply-revision",
    "check-revision",
  ])
    $(id).hidden = true;
  for (const id of ["source-info-status", "explanation-text", "check-text", "suggestion-status"]) {
    $(id).textContent = "";
    $(id).classList.remove("error");
  }
  $("source-alternatives").replaceChildren();
  for (const id of ["explain", "check-translation", "suggest-replies"]) $(id).disabled = false;
  $("explain").setAttribute("aria-expanded", "false");
  $("check-translation").setAttribute("aria-expanded", "false");
  $("check-revision").textContent = "";
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
  featureStatus(statusId, t("working"));
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
    currentTranslation.thai_mode,
    currentTranslation.thai_lexicon,
    currentTranslation.thai_clarification,
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
  const label = t(saved ? "unsaveTranslation" : "saveTranslation");
  $("save-translation").setAttribute("aria-label", label);
  $("save-translation").title = label;
}
function refreshFeatureLabels() {
  updateSavedButton();
  const labels = {
    copy: t("copyTranslation"),
    regenerate: t("regenerateTranslation"),
    "speak-output": t("listenTranslation"),
  };
  for (const [id, label] of Object.entries(labels)) {
    $(id).setAttribute("aria-label", label);
    $(id).title = label;
  }
  if (!currentTranslation) return;
  $("output-language").textContent = LANGUAGES[currentTranslation.target][0];
}
document.addEventListener("translation:invalidated", resetFeatures);
document.addEventListener("translation:complete", (event) => {
  resetFeatures();
  currentTranslation = { ...event.detail, feature: mode };
  for (const id of ["translation-tools", "output-language"]) $(id).hidden = false;
  refreshFeatureLabels();
  resizeOutput();
  // Documents are translated as-is; clickable rewrite and reply suggestions are not offered.
  if (mode === "document") return;
  activeFeature().sourceInfoTimer = setTimeout(() => {
    activeFeature().sourceInfoTimer = null;
    loadSourceInfo();
  }, 350);
});
$("regenerate").addEventListener("click", () => translate({ refresh: true }));
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
const replyStyleLabels = {
  en: { friendly: "Friendly", professional: "Professional", short: "Short", edit: "Edit first" },
  th: { friendly: "เป็นมิตร", professional: "เป็นทางการ", short: "สั้นกระชับ", edit: "แก้ไขก่อน" },
};
function renderReplySuggestions(data) {
  if (!currentTranslation || !Array.isArray(data.replies)) return;
  replySuggestions = data;
  const list = $("reply-suggestions"),
    workspace = activeFeature();
  const labels = replyStyleLabels[locale] || replyStyleLabels.en;
  list.replaceChildren();
  for (const [index, draft] of data.replies.entries()) {
    const detail = data.reply_details?.[index];
    const bilingual = detail && detail.text === draft && typeof detail.translation === "string";
    const text = bilingual ? detail.translation : draft;
    const language = bilingual
      ? data.source_language || effectiveSource()
      : currentTranslation.target;
    const card = document.createElement("article"),
      heading = document.createElement("strong"),
      outgoing = document.createElement("p"),
      actions = document.createElement("div");
    card.className = "reply-suggestion-card";
    heading.className = "reply-suggestion-style";
    heading.textContent = bilingual
      ? labels[detail.style] || detail.style
      : `${t("reply")} ${index + 1}`;
    outgoing.className = "reply-suggestion-text";
    outgoing.textContent = text;
    outgoing.lang = language;
    outgoing.dir = "auto";
    card.append(heading, outgoing);
    if (bilingual) {
      const meaning = document.createElement("p");
      meaning.className = "reply-suggestion-meaning";
      meaning.textContent = draft;
      meaning.lang = currentTranslation.target;
      meaning.dir = "auto";
      card.append(meaning);
    }
    actions.className = "reply-suggestion-actions";
    for (const [icon, label, handler] of [
      [
        "copy",
        t("copy"),
        async () => {
          const epoch = modeEpoch,
            copied = await copyText(text);
          if (workspace === activeFeature() && modeEpoch === epoch)
            featureStatus("suggestion-status", t(copied ? "copied" : "copyFailed"), !copied);
        },
      ],
      ["volume", t("listen"), (button) => speak(text, language, button)],
      ["text", labels.edit, () => openReplyEditor(index)],
    ]) {
      const button = document.createElement("button"),
        svg = document.createElementNS("http://www.w3.org/2000/svg", "svg"),
        use = document.createElementNS("http://www.w3.org/2000/svg", "use");
      button.type = "button";
      button.className =
        icon === "text" ? "outline-button reply-suggestion-edit" : "speaker-button";
      button.setAttribute("aria-label", label);
      button.title = label;
      svg.setAttribute("aria-hidden", "true");
      use.setAttribute("href", `#icon-${icon}`);
      svg.append(use);
      button.append(svg);
      if (icon === "text") {
        const caption = document.createElement("span");
        caption.textContent = label;
        button.append(caption);
      }
      button.addEventListener("click", () => {
        if (workspace === activeFeature()) handler(button);
      });
      actions.append(button);
    }
    card.append(actions);
    list.append(card);
  }
  list.hidden = false;
  $("suggest-replies").setAttribute("aria-expanded", "true");
}
$("suggest-replies").addEventListener("click", async () => {
  if (mode === "document") return;
  if (replySuggestions) {
    const expanded = $("reply-suggestions").hidden;
    $("reply-suggestions").hidden = !expanded;
    $("suggest-replies").setAttribute("aria-expanded", String(expanded));
    return;
  }
  const data = await requestAssistant("replies", "suggestion-status", $("suggest-replies"));
  if (data) renderReplySuggestions(data);
});
function closeReplyEditor() {
  replyEditState?.controller?.abort();
  replyEditState = null;
  if ($("reply-edit-dialog").open) $("reply-edit-dialog").close();
  $("reply-edit-submit").disabled = false;
  $("reply-edit-input").readOnly = false;
}
function openReplyEditor(index) {
  if (!currentTranslation || !replySuggestions?.replies[index]) return;
  closeReplyEditor();
  replyEditState = {
    index,
    workspace: activeFeature(),
    feature: mode,
    revision: featureRevision,
    translation: currentTranslation,
    suggestions: replySuggestions,
    original: replySuggestions.replies[index],
    draftLanguage: currentTranslation.target,
    outgoingLanguage: replySuggestions.source_language || effectiveSource(),
    controller: null,
  };
  const input = $("reply-edit-input");
  input.value = replyEditState.original;
  input.lang = replyEditState.draftLanguage;
  input.placeholder = t("replyPlaceholder");
  input.setAttribute("aria-label", t("yourReply"));
  $("reply-edit-close").setAttribute("aria-label", t("close"));
  $("reply-edit-instructions").textContent = t("replyInstructions")
    .replace("{target}", languageName(replyEditState.draftLanguage))
    .replace("{source}", languageName(replyEditState.outgoingLanguage));
  featureStatus("reply-edit-status");
  $("reply-edit-dialog").showModal();
  input.focus();
}
$("reply-edit-close").addEventListener("click", closeReplyEditor);
$("reply-edit-dialog").addEventListener("close", () => {
  if (!$("reply-edit-dialog").open) closeReplyEditor();
});
$("reply-edit-input").addEventListener("keydown", (event) => {
  if (!event.isComposing && (event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    $("reply-edit-form").requestSubmit();
  }
});
$("reply-edit-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const state = replyEditState,
    draft = $("reply-edit-input").value.trim();
  if (!state || !draft || $("reply-edit-submit").disabled) return;
  if (draft === state.original) {
    closeReplyEditor();
    return;
  }
  if (!LANGUAGES[state.outgoingLanguage] || state.outgoingLanguage === "auto") {
    featureStatus("reply-edit-status", t("chooseSpeaker"), true);
    return;
  }
  const controller = new AbortController();
  state.controller = controller;
  $("reply-edit-submit").disabled = true;
  $("reply-edit-input").readOnly = true;
  featureStatus("reply-edit-status", t("working"));
  const ownsEditor = () =>
    replyEditState === state &&
    activeFeature() === state.workspace &&
    featureRevision === state.revision &&
    $("reply-edit-dialog").open;
  try {
    const data = await responseJson(
      await fetch("/api/translate", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cache_scope: state.feature,
          text: draft,
          source: state.draftLanguage,
          target: state.outgoingLanguage,
          tone: state.translation.tone,
          context: state.translation.context || "general",
          extra_context: state.translation.extra_context || "",
          glossary: state.translation.glossary || [],
        }),
      })
    );
    if (!ownsEditor()) return;
    if (
      typeof data.translation !== "string" ||
      !data.translation.trim() ||
      data.quality_review?.status === "needs_context"
    )
      throw new Error(data.quality_review?.question || t("failed"));
    const suggestions = {
      ...state.suggestions,
      replies: [...state.suggestions.replies],
      reply_details: [...(state.suggestions.reply_details || [])],
    };
    suggestions.replies[state.index] = draft;
    suggestions.source_language = state.outgoingLanguage;
    suggestions.reply_details[state.index] = {
      style:
        state.suggestions.reply_details?.[state.index]?.style ||
        ["friendly", "professional", "short"][state.index],
      text: draft,
      translation: data.translation,
    };
    closeReplyEditor();
    renderReplySuggestions(suggestions);
    $("reply-suggestions")
      .querySelectorAll(".reply-suggestion-edit")
      [state.index]?.focus({ preventScroll: true });
  } catch (error) {
    if (ownsEditor() && error.name !== "AbortError")
      featureStatus("reply-edit-status", error.message || t("failed"), true);
  } finally {
    if (ownsEditor()) {
      $("reply-edit-submit").disabled = false;
      $("reply-edit-input").readOnly = false;
    }
  }
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
  closeReplyEditor();
  for (const name of ["explain", "check", "replies"]) abortFeature(name);
  for (const id of ["explain", "check-translation", "suggest-replies"]) $(id).disabled = false;
  $("explanation-panel").hidden = true;
  $("check-panel").hidden = true;
  $("explanation-text").textContent = "";
  $("check-text").textContent = "";
  $("explain").setAttribute("aria-expanded", "false");
  $("check-translation").setAttribute("aria-expanded", "false");
  featureStatus("suggestion-status");
  if (replySuggestions) {
    const expanded = !$("reply-suggestions").hidden;
    renderReplySuggestions(replySuggestions);
    $("reply-suggestions").hidden = !expanded;
    $("suggest-replies").setAttribute("aria-expanded", String(expanded));
  }
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
  "explanation-panel",
  "check-panel",
  "apply-revision",
  "check-revision",
];
const assistantTextIds = [
  "explanation-text",
  "check-text",
  "check-heading",
  "check-revision",
  "source-info-status",
  "suggestion-status",
];
document.addEventListener("mode:leaving", () => {
  clearTimeout(activeFeature().sourceInfoTimer);
  activeFeature().sourceInfoTimer = null;
  if (assistantRequests().has("source_info")) featureStatus("source-info-status");
  if (assistantRequests().has("replies")) featureStatus("suggestion-status");
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
    suggestions: replySuggestions,
    suggestionsExpanded: !$("reply-suggestions").hidden,
    hidden: Object.fromEntries(assistantHiddenIds.map((id) => [id, $(id).hidden])),
    text: Object.fromEntries(
      assistantTextIds.map((id) => [
        id,
        { text: $(id).textContent, error: $(id).classList.contains("error") },
      ])
    ),
    sourceChips: [...$("source-alternatives").children],
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
  if (saved.suggestions) renderReplySuggestions(saved.suggestions);
  $("reply-suggestions").hidden = !saved.suggestionsExpanded;
  $("suggest-replies").setAttribute("aria-expanded", String(!!saved.suggestionsExpanded));
  for (const [id, hidden] of Object.entries(saved.hidden)) $(id).hidden = hidden;
  for (const [id, value] of Object.entries(saved.text)) {
    $(id).textContent = value.text;
    $(id).classList.toggle("error", value.error);
  }
  $("source-alternatives").replaceChildren(...saved.sourceChips);
  $("explain").setAttribute("aria-expanded", saved.explainExpanded);
  $("check-translation").setAttribute("aria-expanded", saved.checkExpanded);
  refreshFeatureLabels();
  resizeOutput();
});
