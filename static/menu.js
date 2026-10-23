/* Translation preferences, additional languages and feature-scoped local history. */
Object.assign(COPY.en, { additionalPaused: "Translation paused. Retry this language." });
Object.assign(COPY.th, { additionalPaused: "หยุดแปลภาษานี้แล้ว กดลองใหม่เมื่อต้องการ" });
Object.assign(COPY.en, {
  menu: "Menu",
  style: "Style",
  friendly: "Friendly",
  context: "Context",
  general: "General",
  travel: "Travel",
  work: "Work",
  study: "Study",
  conversation: "Conversation",
  multipleLanguages: "Translate into several languages",
  additionalHelp: "Choose up to 3 additional target languages.",
  historyFavorites: "History & favorites",
  favoritesOnly: "Favorites only",
  clearAll: "Clear all",
  starToKeep: "Star a translation to keep it.",
  extraContextHint: "Extra context (optional), e.g. replying to a friend",
  historySearchHint: "Search your translations…",
  noHistory: "Your translations will appear here.",
  noHistoryMatch: "No matching translations.",
  additionalSearchHint: "Search languages…",
  selectedLanguages: "{count} / 3 languages selected",
  historyCleared: "History cleared for this feature.",
  favoriteTranslation: "Favorite translation",
  deleteTranslation: "Delete translation",
  closeMenu: "Close menu",
});
Object.assign(COPY.th, {
  menu: "เมนู",
  style: "สไตล์",
  friendly: "เป็นมิตร",
  context: "บริบท",
  general: "ทั่วไป",
  travel: "ท่องเที่ยว",
  work: "ทำงาน",
  study: "การเรียน",
  conversation: "สนทนา",
  multipleLanguages: "แปลเป็นหลายภาษา",
  additionalHelp: "เลือกภาษาปลายทางเพิ่มเติมได้สูงสุด 3 ภาษา",
  historyFavorites: "ประวัติและรายการโปรด",
  favoritesOnly: "รายการโปรดเท่านั้น",
  clearAll: "ล้างทั้งหมด",
  starToKeep: "กดดาวเพื่อเก็บคำแปลเป็นรายการโปรด",
  extraContextHint: "บริบทเพิ่มเติม (ไม่บังคับ) เช่น ตอบเพื่อน",
  historySearchHint: "ค้นหาคำแปลของคุณ…",
  noHistory: "คำแปลของคุณจะแสดงที่นี่",
  noHistoryMatch: "ไม่พบคำแปลที่ตรงกัน",
  additionalSearchHint: "ค้นหาภาษา…",
  selectedLanguages: "เลือกแล้ว {count} / 3 ภาษา",
  historyCleared: "ล้างประวัติของฟีเจอร์นี้แล้ว",
  favoriteTranslation: "เก็บเป็นรายการโปรด",
  deleteTranslation: "ลบคำแปล",
  closeMenu: "ปิดเมนู",
});
Object.assign(COPY.en, {
  restaurant: "Food & restaurants",
  shopping: "Shopping",
  health: "Symptoms & healthcare",
  scenarioGeneral:
    "For more natural wording, choose your situation and tell us who you are speaking to.",
  scenarioConversation:
    "Everyday messages, idioms and natural replies. Add your relationship to the listener if it matters.",
  scenarioRestaurant:
    "Ordering food, table requests, allergies and dietary needs. Include your restrictions explicitly.",
  scenarioShopping: "Prices, sizes, payment and returns. Amounts and currencies stay as written.",
  scenarioHealth:
    "Describe symptoms, duration and medicines. Translates your words without adding a diagnosis.",
  scenarioTravel:
    "Hotels, directions and transport. Include the destination, date or booking details when relevant.",
  scenarioWork:
    "Messages to colleagues or clients. Include the relationship and whether a plan is confirmed.",
  scenarioStudy:
    "Lessons and technical material. Include the subject to help select the right terms.",
});
Object.assign(COPY.th, {
  restaurant: "อาหารและร้านอาหาร",
  shopping: "ซื้อของ",
  health: "อาการและการพบแพทย์",
  scenarioGeneral: "เลือกสถานการณ์และบอกว่ากำลังคุยกับใคร เพื่อช่วยเลือกคำให้เหมาะกับการใช้จริง",
  scenarioConversation:
    "ข้อความประจำวัน สำนวน และคำตอบที่เป็นธรรมชาติ ระบุความสัมพันธ์กับคู่สนทนาเพิ่มเติมได้",
  scenarioRestaurant: "สั่งอาหาร ขอโต๊ะ แจ้งอาการแพ้และข้อจำกัดอาหาร ระบุสิ่งที่ทานไม่ได้ให้ชัดเจน",
  scenarioShopping: "ราคา ไซซ์ การชำระเงิน และคืนสินค้า เก็บจำนวนเงินและสกุลเงินตามต้นฉบับ",
  scenarioHealth: "บอกอาการ ระยะเวลา และยาที่ใช้ แปลตามที่คุณเขียนโดยไม่เพิ่มการวินิจฉัย",
  scenarioTravel: "โรงแรม ถามทาง และเดินทาง ใส่จุดหมาย วันที่ หรือรายละเอียดการจองเมื่อจำเป็น",
  scenarioWork:
    "คุยกับเพื่อนร่วมงานหรือลูกค้า ระบุความสัมพันธ์และแผนที่ยืนยันแล้วเพื่อเลือกคำให้ตรง",
  scenarioStudy: "บทเรียนและเนื้อหาวิชาการ ระบุวิชาเพื่อช่วยเลือกศัพท์ให้ตรงความหมาย",
});
function renderScenarioHelp() {
  const key = activeFeature().preferences.context;
  $("scenario-help").textContent = t("scenario" + key[0].toUpperCase() + key.slice(1));
}
const menuIconButton = (icon, label, action) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "speaker-button";
  button.setAttribute("aria-label", label);
  button.title = label;
  button.innerHTML = `<svg aria-hidden="true"><use href="#icon-${icon}"/></svg>`;
  button.addEventListener("click", action);
  return button;
};
function menuStatus(message = "", error = false) {
  $("menu-status").textContent = message;
  $("menu-status").classList.toggle("error", error);
}
function renderHistory() {
  const preferences = activeFeature().preferences,
    query = preferences.historyQuery.toLocaleLowerCase().trim();
  const own = savedTranslations.filter((item) => (item.feature || "text") === mode);
  const records = own.filter(
    (item) =>
      (!preferences.favoritesOnly || item.favorite) &&
      `${item.text} ${item.translation} ${LANGUAGES[item.source]?.join(" ")} ${LANGUAGES[item.target]?.join(" ")} ${LANGUAGE_CATALOG[item.source]?.thai || ""} ${LANGUAGE_CATALOG[item.target]?.thai || ""}`
        .toLocaleLowerCase()
        .includes(query)
  );
  $("history-list").replaceChildren();
  $("history-clear").disabled = !own.length;
  if (!records.length) {
    const empty = document.createElement("p");
    empty.className = "menu-help";
    empty.textContent = t(own.length ? "noHistoryMatch" : "noHistory");
    $("history-list").append(empty);
  }
  for (const item of records) {
    const card = document.createElement("article");
    card.className = "history-entry";
    const header = document.createElement("header"),
      info = document.createElement("span");
    const source = item.sourceLanguage || item.source;
    const date = Number.isFinite(item.savedAt)
      ? new Date(item.savedAt).toLocaleDateString(locale === "th" ? "th-TH" : "en-GB")
      : "";
    info.textContent = `${LANGUAGES[source]?.[0] || source} → ${LANGUAGES[item.target][0]}${date ? " · " + date : ""}`;
    const favorite = menuIconButton("star", t("favoriteTranslation"), () => {
      if (
        persistSaved(
          savedTranslations.map((record) =>
            savedId(record) === savedId(item) ? { ...record, favorite: !item.favorite } : record
          )
        )
      )
        updateSavedButton();
    });
    favorite.setAttribute("aria-pressed", String(!!item.favorite));
    const owner = mode,
      epoch = modeEpoch;
    const copy = menuIconButton("copy", t("copy"), async () => {
      await copyText(item.translation);
      if (mode === owner && modeEpoch === epoch)
        menuStatus(statusEl.textContent, statusEl.classList.contains("error"));
    });
    header.append(info, favorite, copy);
    const original = document.createElement("p");
    original.className = "history-original";
    original.textContent = item.text;
    original.lang = source;
    original.dir = "auto";
    const result = document.createElement("p");
    result.className = "history-translation";
    result.textContent = item.translation;
    result.lang = item.target;
    result.dir = "auto";
    const footer = document.createElement("footer");
    footer.append(
      menuIconButton("trash", t("deleteTranslation"), () => {
        if (persistSaved(savedTranslations.filter((record) => savedId(record) !== savedId(item))))
          updateSavedButton();
      })
    );
    card.append(header, original, result, footer);
    $("history-list").append(card);
  }
}
function renderAdditionalChoices() {
  const preferences = activeFeature().preferences,
    primary = activeLanguages()[1];
  preferences.targets = preferences.targets.filter((code) => code !== primary);
  $("additional-language-options").hidden = !preferences.multiple;
  $("additional-count").textContent = t("selectedLanguages").replace(
    "{count}",
    preferences.targets.length
  );
  const query = $("additional-search").value.toLocaleLowerCase().trim();
  $("additional-targets").replaceChildren();
  for (const [code, entry] of Object.entries(LANGUAGE_CATALOG)) {
    if (
      code === primary ||
      !`${entry.name} ${entry.native} ${entry.thai}`.toLocaleLowerCase().includes(query)
    )
      continue;
    const label = document.createElement("label"),
      checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = code;
    checkbox.checked = preferences.targets.includes(code);
    checkbox.disabled = !checkbox.checked && preferences.targets.length >= 3;
    const name = document.createElement("span");
    name.textContent = locale === "th" ? entry.thai : entry.name;
    checkbox.addEventListener("change", () => {
      if (checkbox.checked && preferences.targets.length < 3) preferences.targets.push(code);
      else preferences.targets = preferences.targets.filter((target) => target !== code);
      const scroll = $("additional-targets").scrollTop;
      renderAdditionalChoices();
      $("additional-targets").scrollTop = scroll;
      document.dispatchEvent(new CustomEvent("translation:settings"));
    });
    label.append(checkbox, name);
    $("additional-targets").append(label);
  }
}
function refreshMenu() {
  const preferences = activeFeature().preferences;
  $("translation-context").value = preferences.context;
  $("extra-context").value = preferences.extraContext;
  $("multiple-languages").checked = preferences.multiple;
  $("history-favorites").checked = preferences.favoritesOnly;
  $("history-search").value = preferences.historyQuery;
  $("extra-context").placeholder = t("extraContextHint");
  $("extra-context").setAttribute("aria-label", t("extraContextHint"));
  $("history-search").placeholder = t("historySearchHint");
  $("history-search").setAttribute("aria-label", t("historySearchHint"));
  $("additional-search").placeholder = t("additionalSearchHint");
  $("additional-search").setAttribute("aria-label", t("additionalSearchHint"));
  $("menu-close").setAttribute("aria-label", t("closeMenu"));
  renderScenarioHelp();
  renderAdditionalChoices();
  renderHistory();
}
$("translation-context").addEventListener("change", () => {
  activeFeature().preferences.context = $("translation-context").value;
  renderScenarioHelp();
  document.dispatchEvent(new CustomEvent("translation:settings"));
});
$("extra-context").addEventListener("input", () => {
  activeFeature().preferences.extraContext = $("extra-context").value;
  document.dispatchEvent(new CustomEvent("translation:settings"));
});
$("multiple-languages").addEventListener("change", () => {
  activeFeature().preferences.multiple = $("multiple-languages").checked;
  renderAdditionalChoices();
  document.dispatchEvent(new CustomEvent("translation:settings"));
});
$("additional-search").addEventListener("input", renderAdditionalChoices);
$("history-search").addEventListener("input", () => {
  activeFeature().preferences.historyQuery = $("history-search").value;
  renderHistory();
});
$("history-favorites").addEventListener("change", () => {
  activeFeature().preferences.favoritesOnly = $("history-favorites").checked;
  renderHistory();
});
$("history-clear").addEventListener("click", () => {
  if (persistSaved(savedTranslations.filter((item) => (item.feature || "text") !== mode))) {
    updateSavedButton();
    menuStatus(t("historyCleared"));
  }
});
$("live-settings-toggle").addEventListener("click", () => $("settings-toggle").click());
$("settings").addEventListener("close", () =>
  $("live-settings-toggle").setAttribute("aria-expanded", "false")
);
document.addEventListener("menu:open", () => {
  $("additional-search").value = "";
  menuStatus();
  refreshMenu();
  $("live-settings-toggle").setAttribute("aria-expanded", "true");
});
document.addEventListener("history:change", renderHistory);
document.addEventListener("languages:change", () => {
  if ($("settings").open) renderAdditionalChoices();
});

function clearAdditionalResults() {
  activeFeature().additionalRequests.forEach((controller) => controller.abort());
  activeFeature().additionalRequests.clear();
  activeFeature().additional = [];
  activeFeature().additionalContext = null;
  $("additional-results").replaceChildren();
  $("additional-results").hidden = true;
}
function additionalRequestBody(detail, target) {
  return {
    ...thaiSnapshotOptions(detail),
    cache_scope: mode,
    text: detail.text,
    source: detail.source,
    target,
    tone: detail.tone,
    context: detail.context || "general",
    extra_context: detail.extra_context || "",
    glossary: detail.glossary || [],
    conversation: detail.conversation || [],
  };
}
function applyAdditionalTranslation(result, data, detail) {
  if (data.interpretation?.status === "needs_context") throw new Error(t("thaiNeedContext"));
  if (data.quality_review?.status === "needs_context")
    throw new Error(`${t("meaningNeedsContext")} ${data.quality_review.question || ""}`);
  result.quality_review = data.quality_review || null;
  result.translation = data.translation;
  result.audit = data.audit || null;
  delete result.error;
  delete result.pending;
  rememberTranslation({
    ...detail,
    target: result.target,
    translation: data.translation,
    audit: data.audit || null,
  });
}
function renderAdditionalResults() {
  const results = activeFeature().additional,
    detail = activeFeature().additionalContext;
  $("additional-results").replaceChildren();
  $("additional-results").hidden = !results.length;
  for (const result of results) {
    const card = document.createElement("article");
    card.className = "additional-result";
    const header = document.createElement("header"),
      title = document.createElement("h3"),
      actions = document.createElement("div");
    actions.className = "additional-actions";
    title.textContent = LANGUAGES[result.target][0];
    header.append(title, actions);
    const text = document.createElement("p");
    text.dir = "auto";
    text.lang = result.target;
    text.textContent = result.pending ? t("loading") : result.translation || result.error;
    if (result.error || result.pending) {
      text.className = result.error ? "error" : "";
      const retry = document.createElement("button");
      retry.className = "outline-button";
      retry.type = "button";
      retry.textContent = t(result.pending ? "loading" : "retry");
      retry.disabled = !!result.pending;
      const workspace = activeFeature(),
        epoch = modeEpoch;
      const load = async () => {
        if (
          workspace !== activeFeature() ||
          modeEpoch !== epoch ||
          workspace.additionalRequests.has(result.target)
        )
          return;
        const controller = new AbortController();
        workspace.additionalRequests.set(result.target, controller);
        retry.disabled = true;
        try {
          const data = await responseJson(
            await fetch("/api/translate", {
              method: "POST",
              signal: controller.signal,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(additionalRequestBody(detail, result.target)),
            })
          );
          if (
            workspace !== activeFeature() ||
            modeEpoch !== epoch ||
            workspace.additionalRequests.get(result.target) !== controller
          )
            return;
          applyAdditionalTranslation(result, data, detail);
          renderAdditionalResults();
        } catch (error) {
          if (
            error.name !== "AbortError" &&
            workspace === activeFeature() &&
            modeEpoch === epoch &&
            workspace.additionalRequests.get(result.target) === controller
          ) {
            result.error = error.message;
            result.pending = false;
            renderAdditionalResults();
          }
        } finally {
          if (workspace.additionalRequests.get(result.target) === controller)
            workspace.additionalRequests.delete(result.target);
        }
      };
      retry.addEventListener("click", load);
      if (result.pending && !workspace.additionalRequests.has(result.target)) queueMicrotask(load);
      card.append(header, text, retry);
    } else {
      actions.append(
        menuIconButton("copy", t("copy"), () => copyText(result.translation)),
        menuIconButton("volume", t("listen"), () => speak(result.translation, result.target))
      );
      card.append(header, text);
      if (["unavailable", "rejected", "length_limit"].includes(result.quality_review?.status)) {
        const warning = document.createElement("p");
        warning.className = "feature-status";
        warning.textContent = t("meaningReviewUnavailable");
        card.append(warning);
      }
      if (result.audit?.status === "review") {
        const check = document.createElement("details");
        check.className = "studio-back";
        const title = document.createElement("summary");
        title.textContent = t("consistencyReview").replace("{count}", result.audit.issues.length);
        const content = document.createElement("div");
        renderAudit(content, result.audit);
        check.append(title, content);
        card.append(check);
      }
    }
    $("additional-results").append(card);
  }
}
function recordTranslationGroup(detail) {
  rememberTranslation(detail);
  activeFeature().additional = detail.additional_translations || [];
  activeFeature().additionalContext = detail;
  for (const result of activeFeature().additional)
    if (result.translation)
      rememberTranslation({
        ...detail,
        target: result.target,
        translation: result.translation,
        audit: result.audit || null,
      });
  renderAdditionalResults();
}
document.addEventListener("translation:complete", ({ detail }) => recordTranslationGroup(detail));
document.addEventListener("history:record", ({ detail }) => {
  if (detail.feature === mode) recordTranslationGroup(detail);
});
document.addEventListener("translation:invalidated", clearAdditionalResults);
document.addEventListener("additional:clear", clearAdditionalResults);
document.addEventListener("mode:leaving", () => {
  for (const result of activeFeature().additional)
    if (result.pending) {
      result.pending = false;
      result.error = t("additionalPaused");
    }
  activeFeature().additionalRequests.forEach((controller) => controller.abort());
  activeFeature().additionalRequests.clear();
});
document.addEventListener("mode:restored", () => {
  $("additional-search").value = "";
  refreshMenu();
  renderAdditionalResults();
});
document.addEventListener("interface:change", () => {
  refreshMenu();
  renderAdditionalResults();
});
refreshMenu();

document.addEventListener(
  "chat:retry-additional",
  async ({ detail: { turn, result, text, button } }) => {
    if (mode !== "live") return;
    const workspace = activeFeature(),
      epoch = modeEpoch,
      key = savedId({ ...turn, target: result.target }),
      controller = new AbortController();
    workspace.chatRequests.get(key)?.abort();
    workspace.chatRequests.set(key, controller);
    button.disabled = true;
    controller.pause = () => {
      result.pending = false;
      result.error = t("additionalPaused");
      text.textContent = `${LANGUAGES[result.target][0]} · ${result.error}`;
      button.disabled = false;
      button.textContent = t("retry");
    };
    try {
      const data = await responseJson(
        await fetch("/api/translate", {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(additionalRequestBody(turn, result.target)),
        })
      );
      if (
        workspace !== activeFeature() ||
        modeEpoch !== epoch ||
        workspace.chatRequests.get(key) !== controller
      )
        return;
      applyAdditionalTranslation(result, data, turn);
      text.textContent = `${LANGUAGES[result.target][0]} · ${data.translation}`;
      button.remove();
    } catch (error) {
      if (
        error.name !== "AbortError" &&
        workspace === activeFeature() &&
        modeEpoch === epoch &&
        workspace.chatRequests.get(key) === controller
      ) {
        result.error = error.message;
        result.pending = false;
        text.textContent = `${LANGUAGES[result.target][0]} · ${error.message}`;
        button.disabled = false;
        button.textContent = t("retry");
      }
    } finally {
      if (workspace.chatRequests.get(key) === controller) workspace.chatRequests.delete(key);
    }
  }
);
function cancelChatRetries() {
  activeFeature().chatRequests.forEach((controller) => {
    controller.pause?.();
    controller.abort();
  });
  activeFeature().chatRequests.clear();
}
document.addEventListener("mode:leaving", cancelChatRetries);
$("clear-chat").addEventListener("click", cancelChatRetries);
