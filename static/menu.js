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
const preferenceDialog = $("preference-dialog"),
  preferenceOptions = $("preference-options");
const preferenceTriggers = new Map();
let preferenceSource = null;
const preferenceIcons = {
  natural: "sparkles",
  friendly: "star",
  formal: "document",
  casual: "reply",
  general: "globe",
  travel: "arrow",
  work: "document",
  study: "text",
  conversation: "reply",
  restaurant: "menu-food",
  shopping: "menu-bag",
  health: "menu-health",
};
function preferenceIcon(name, className = "") {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("aria-hidden", "true");
  if (className) svg.setAttribute("class", className);
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#icon-${name}`);
  svg.append(use);
  return svg;
}
function preferenceTitle(select) {
  return t(select.id === "tone" ? "tone" : "context");
}
function refreshPreferenceTriggers() {
  for (const [select, button] of preferenceTriggers) {
    const title = preferenceTitle(select);
    const selected = select.selectedOptions[0];
    const text = document.createElement("span");
    text.className = "preference-trigger-label";
    text.textContent = t(selected.dataset.i18n);
    const icon = document.createElement("span");
    icon.className = "preference-trigger-icon";
    icon.append(preferenceIcon(preferenceIcons[select.value]));
    button.replaceChildren(icon, text, preferenceIcon("chevron", "preference-chevron"));
    button.setAttribute("aria-label", `${title} · ${text.textContent}`);
    button.title = text.textContent;
  }
}
function renderPreferenceOptions() {
  if (!preferenceSource) return;
  const context = preferenceSource.id === "translation-context";
  preferenceDialog.classList.toggle("tone-picker", !context);
  $("preference-title").textContent = preferenceTitle(preferenceSource);
  $("preference-close").setAttribute("aria-label", t("close"));
  preferenceOptions.classList.toggle("context-options", context);
  preferenceOptions.replaceChildren();
  for (const option of preferenceSource.options) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "preference-option";
    button.dataset.value = option.value;
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", String(option.selected));
    button.tabIndex = option.selected ? 0 : -1;
    const icon = document.createElement("span");
    icon.className = "preference-option-icon";
    icon.append(preferenceIcon(preferenceIcons[option.value]));
    const name = document.createElement("span");
    name.className = "preference-option-name";
    name.textContent = t(option.dataset.i18n);
    button.append(icon, name);
    if (context) {
      const help = document.createElement("span");
      help.className = "preference-option-help";
      help.textContent = t("scenario" + option.value[0].toUpperCase() + option.value.slice(1));
      button.append(help);
      button.title = help.textContent;
    }
    button.append(preferenceIcon("check", "preference-option-check"));
    button.addEventListener("click", () => {
      const select = preferenceSource;
      const changed = select.value !== option.value;
      select.value = option.value;
      if (changed) select.dispatchEvent(new Event("change", { bubbles: true }));
      refreshPreferenceTriggers();
      preferenceDialog.close();
    });
    button.addEventListener("keydown", (event) => {
      const buttons = [...preferenceOptions.querySelectorAll('[role="option"]')];
      const columns = getComputedStyle(preferenceOptions).gridTemplateColumns.split(" ").length;
      const rtl = document.documentElement.dir === "rtl";
      let step =
        event.key === "ArrowDown"
          ? columns
          : event.key === "ArrowUp"
            ? -columns
            : event.key === "ArrowRight"
              ? rtl
                ? -1
                : 1
              : event.key === "ArrowLeft"
                ? rtl
                  ? 1
                  : -1
                : 0;
      if (!step && !["Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const index =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? buttons.length - 1
            : (buttons.indexOf(button) + step + buttons.length) % buttons.length;
      for (const candidate of buttons) candidate.tabIndex = candidate === buttons[index] ? 0 : -1;
      buttons[index].focus();
    });
    preferenceOptions.append(button);
  }
}
for (const id of ["tone", "translation-context"]) {
  const select = $(id),
    button = document.createElement("button");
  button.id = id + "-trigger";
  button.type = "button";
  button.className = "preference-trigger";
  button.setAttribute("aria-haspopup", "listbox");
  button.setAttribute("aria-controls", "preference-options");
  button.setAttribute("aria-expanded", "false");
  // Retain the native model and its change events for feature-owned settings.
  select.hidden = true;
  select.parentElement.append(button);
  preferenceTriggers.set(select, button);
  function open() {
    preferenceSource = select;
    renderPreferenceOptions();
    for (const candidate of preferenceTriggers.values())
      candidate.setAttribute("aria-expanded", String(candidate === button));
    preferenceDialog.showModal();
    preferenceOptions.querySelector('[aria-selected="true"]').focus();
  }
  button.addEventListener("click", open);
  button.addEventListener("keydown", (event) => {
    if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
    event.preventDefault();
    open();
  });
  select.addEventListener("change", refreshPreferenceTriggers);
}
$("preference-close").addEventListener("click", () => preferenceDialog.close());
preferenceDialog.addEventListener("close", () => {
  // A queued close event must not reset a picker that has already reopened.
  if (preferenceDialog.open) return;
  for (const trigger of preferenceTriggers.values()) trigger.setAttribute("aria-expanded", "false");
  preferenceSource = null;
  // The native dialog restores focus synchronously; do not steal a later focus.
});
preferenceDialog.addEventListener("click", (event) => {
  if (event.target !== preferenceDialog) return;
  const box = preferenceDialog.getBoundingClientRect();
  if (
    event.clientX < box.left ||
    event.clientX > box.right ||
    event.clientY < box.top ||
    event.clientY > box.bottom
  )
    preferenceDialog.close();
});
refreshPreferenceTriggers();
const menuTabs = [...document.querySelectorAll('.menu-tabs [role="tab"]')];
function selectMenuTab(tab, focus = false) {
  for (const item of menuTabs) {
    const selected = item === tab;
    item.setAttribute("aria-selected", String(selected));
    item.tabIndex = selected ? 0 : -1;
    $(item.getAttribute("aria-controls")).hidden = !selected;
  }
  document.querySelector(".menu-content").scrollTop = 0;
  if (focus) tab.focus();
}
for (const tab of menuTabs) {
  tab.addEventListener("click", () => selectMenuTab(tab));
  tab.addEventListener("keydown", (event) => {
    const rtl = document.documentElement.dir === "rtl";
    let direction = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (rtl) direction *= -1;
    if (!direction && !["Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const index =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? menuTabs.length - 1
          : (menuTabs.indexOf(tab) + direction + menuTabs.length) % menuTabs.length;
    selectMenuTab(menuTabs[index], true);
  });
}
function syncMenuTheme() {
  const light = document.documentElement.dataset.theme === "light";
  $("menu-theme").querySelector(".menu-theme-label").textContent = t(
    light ? "darkTheme" : "lightTheme"
  );
  $("menu-theme").setAttribute("aria-pressed", String(light));
  $("menu-theme")
    .querySelector("use")
    .setAttribute("href", light ? "#icon-moon" : "#icon-sun");
}
$("menu-theme").addEventListener("click", () => $("theme").click());
$("theme").addEventListener("click", syncMenuTheme);
document.addEventListener("interface:change", syncMenuTheme);
syncMenuTheme();
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
      ? new Date(item.savedAt).toLocaleDateString(locale)
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
function additionalFlag(code) {
  const flag = document.createElement("img");
  flag.src = languageFlag(code);
  flag.alt = "";
  flag.width = 26;
  flag.height = 20;
  flag.loading = "lazy";
  return flag;
}
function updateAdditionalSelection(code, selected) {
  const preferences = activeFeature().preferences,
    list = $("additional-targets"),
    scroll = list.scrollTop;
  if (selected && !preferences.targets.includes(code) && preferences.targets.length < 3)
    preferences.targets.push(code);
  else if (!selected) preferences.targets = preferences.targets.filter((target) => target !== code);
  renderAdditionalChoices();
  list.scrollTop = scroll;
  document.dispatchEvent(new CustomEvent("translation:settings"));
}
function renderAdditionalChoices() {
  const preferences = activeFeature().preferences,
    primary = activeLanguages()[1],
    list = $("additional-targets"),
    selected = $("additional-selected");
  preferences.targets = preferences.targets.filter((code) => code !== primary);
  $("additional-language-options").hidden = !preferences.multiple;
  $("additional-count").textContent = t("selectedLanguages").replace(
    "{count}",
    preferences.targets.length
  );
  $("additional-count").classList.toggle("is-full", preferences.targets.length >= 3);
  selected.replaceChildren();
  selected.hidden = !preferences.targets.length;
  for (const code of preferences.targets) {
    const chip = document.createElement("button"),
      name = document.createElement("bdi");
    chip.type = "button";
    chip.className = "additional-chip";
    chip.dataset.language = code;
    chip.setAttribute("aria-label", `${t("remove")} · ${languageName(code)}`);
    name.textContent = languageName(code);
    chip.append(additionalFlag(code), name, preferenceIcon("close"));
    chip.addEventListener("click", () => {
      const index = preferences.targets.indexOf(code);
      updateAdditionalSelection(code, false);
      const chips = selected.querySelectorAll("button");
      (chips[Math.min(index, chips.length - 1)] || $("additional-search")).focus({
        preventScroll: true,
      });
    });
    selected.append(chip);
  }
  const query = languageSearchText($("additional-search").value);
  list.replaceChildren();
  for (const [code, entry] of Object.entries(LANGUAGE_CATALOG)) {
    if (
      code === primary ||
      !languageSearchText(
        `${languageName(code)} ${entry.name} ${entry.native} ${entry.thai} ${code}`
      ).includes(query)
    )
      continue;
    const label = document.createElement("label"),
      checkbox = document.createElement("input"),
      names = document.createElement("span"),
      name = document.createElement("bdi"),
      native = document.createElement("bdi");
    names.className = "additional-language-name";
    name.textContent = languageName(code);
    native.textContent = entry.native;
    native.className = "additional-language-native";
    native.hidden = entry.native === name.textContent;
    names.append(name, native);
    checkbox.type = "checkbox";
    checkbox.value = code;
    checkbox.setAttribute("aria-label", languageName(code));
    checkbox.checked = preferences.targets.includes(code);
    checkbox.disabled = !checkbox.checked && preferences.targets.length >= 3;
    checkbox.addEventListener("change", () => {
      updateAdditionalSelection(code, checkbox.checked);
      list.querySelector(`input[value="${code}"]`)?.focus({ preventScroll: true });
    });
    label.append(additionalFlag(code), names, checkbox);
    list.append(label);
  }
  $("additional-empty").textContent = t("languageNoResults");
  $("additional-empty").hidden = list.childElementCount > 0;
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
  refreshPreferenceTriggers();
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
  selectMenuTab(menuTabs[0]);
  syncMenuTheme();
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
