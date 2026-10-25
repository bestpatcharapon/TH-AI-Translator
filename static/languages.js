/* Searchable language dialog shares the native selects and their change events. */
Object.assign(COPY.en, {
  translateFrom: "Translate from",
  translateTo: "Translate to",
  searchLanguages: "Search languages",
  languageSearchHint: "Search languages, e.g. Japanese",
  languageNoResults: "No languages found. Try another name.",
  closeLanguages: "Close language picker",
  interfaceLanguage: "App language",
  appearance: "Appearance",
  interfaceLanguageHelp:
    "English by default. Menu languages use bundled translations and do not call AI.",
  interfaceLanguageTimeout:
    "Loading the menu language timed out. Your previous language is still active. Please try again.",
  interfaceLanguageLoading: "Loading menu language… You can choose another language to cancel.",
  interfaceLanguageFailed:
    "Could not load this menu language. Your previous language is still active. Please try again.",
  interfaceLanguages: "{count} menu languages available · Loaded from bundled translations.",
  wordCharacterCount: "{words} words · {characters} characters",
  detectLanguage: "Detect language",
  saveTranslation: "Save translation",
  unsaveTranslation: "Unsave translation",
  copyTranslation: "Copy translation",
  regenerateTranslation: "Translate again",
  listenTranslation: "Listen to translation",
  replyInstructions: "Write your reply in {target} and get it in {source}.",
});
Object.assign(COPY.th, {
  translateFrom: "แปลจากภาษา",
  translateTo: "แปลเป็นภาษา",
  searchLanguages: "ค้นหาภาษา",
  languageSearchHint: "ค้นหาภาษา เช่น ญี่ปุ่น",
  languageNoResults: "ไม่พบภาษา ลองค้นหาด้วยชื่ออื่น",
  closeLanguages: "ปิดตัวเลือกภาษา",
  interfaceLanguage: "ภาษาแอป",
  appearance: "การแสดงผล",
  interfaceLanguageHelp: "เริ่มต้นเป็นอังกฤษ ภาษาเมนูใช้คำแปลที่เตรียมไว้ในแอป ไม่เรียก AI",
  interfaceLanguageTimeout: "โหลดภาษาเมนูนานเกินไป ยังคงใช้ภาษาเดิม กรุณาลองใหม่",
  interfaceLanguageLoading: "กำลังโหลดภาษาเมนู… เลือกภาษาอื่นเพื่อยกเลิกได้",
  interfaceLanguageFailed: "โหลดภาษาเมนูไม่สำเร็จ ยังคงใช้ภาษาเดิม กรุณาลองใหม่",
  interfaceLanguages: "ภาษาเมนูพร้อมใช้ {count} ภาษา · โหลดจากคำแปลที่มีในแอป",
  wordCharacterCount: "{words} คำ · {characters} ตัวอักษร",
  detectLanguage: "ตรวจจับภาษา",
  saveTranslation: "บันทึกคำแปล",
  unsaveTranslation: "นำคำแปลออกจากรายการบันทึก",
  copyTranslation: "คัดลอกคำแปล",
  regenerateTranslation: "แปลใหม่",
  listenTranslation: "ฟังคำแปล",
  replyInstructions: "เขียนคำตอบเป็น{target} แล้วแปลกลับเป็น{source}",
});
Object.assign(COPY.en, {
  microphoneUnavailable:
    "Microphone input is not available for this language. Type your message instead.",
  voiceUnavailable:
    "No reading voice is available for this language. You can read or copy the translation.",
  languageQuality: "{count} languages · AI translation quality varies by language.",
  photoLanguages:
    "Photos can be read in {count} source languages. Translate into any listed language.",
  liveLanguages: "Languages without microphone support can still be used by typing.",
});
Object.assign(COPY.th, {
  microphoneUnavailable: "ยังไม่รองรับไมโครโฟนภาษานี้ กรุณาพิมพ์ข้อความแทน",
  voiceUnavailable: "ยังไม่มีเสียงอ่านสำหรับภาษานี้ สามารถอ่านหรือคัดลอกคำแปลได้",
  languageQuality: "{count} ภาษา · คุณภาพการแปลด้วย AI แตกต่างกันตามภาษา",
  photoLanguages: "อ่านภาพได้ {count} ภาษาต้นทาง และแปลเป็นภาษาปลายทางในรายการได้",
  liveLanguages: "ภาษาที่ไม่รองรับไมค์ยังสนทนาด้วยการพิมพ์ได้",
});
const languageAliases = {
  auto: "detect automatic อัตโนมัติ ตรวจจับภาษา",
  th: "ไทย ภาษาไทย thailand",
  en: "อังกฤษ ภาษาอังกฤษ english uk usa",
  zh: "จีน ภาษาจีน simplified mandarin 简体 中文",
  ja: "ญี่ปุ่น ภาษาญี่ปุ่น japanese 日本語",
  ko: "เกาหลี ภาษาเกาหลี korean 한국어",
  vi: "เวียดนาม ภาษาเวียดนาม vietnamese tiếng việt",
  fr: "ฝรั่งเศส ภาษาฝรั่งเศส french français",
  de: "เยอรมัน ภาษาเยอรมัน german deutsch",
  es: "สเปน ภาษาสเปน spanish español",
  ru: "รัสเซีย ภาษารัสเซีย russian русский",
};
const languageDialog = $("language-dialog"),
  languageSearch = $("language-search"),
  languageOptions = $("language-options");
const languageTriggers = new Map();
let languageSelect = null;
function languageSearchText(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .trim();
}
function languageName(code) {
  if (code === "auto") return t("detectLanguage");
  if (locale === "th") return LANGUAGE_CATALOG[code]?.thai || LANGUAGES[code][0];
  if (locale !== "en") {
    try {
      return new Intl.DisplayNames([locale], { type: "language" }).of(code) || LANGUAGES[code][0];
    } catch {
      /* Use catalog name. */
    }
  }
  return LANGUAGES[code][0];
}
function languagePickerTitle(select) {
  return select?.id === "interface-language"
    ? "interfaceLanguage"
    : select === sourceEl
      ? "translateFrom"
      : "translateTo";
}
function renderLanguageOptions() {
  if (!languageSelect) return;
  const query = languageSearchText(languageSearch.value),
    fragment = document.createDocumentFragment();
  for (const option of languageSelect.options) {
    const code = option.value;
    if (
      option.disabled ||
      !languageSearchText(
        `${languageName(code)} ${LANGUAGES[code][0]} ${LANGUAGES[code][1]} ${languageAliases[code] || ""} ${LANGUAGE_CATALOG[code]?.thai || ""} ${code}`
      ).includes(query)
    )
      continue;
    const selected = code === languageSelect.value;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "language-option";
    button.dataset.language = code;
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", String(selected));
    const flag = document.createElement("img");
    flag.src = languageFlag(code);
    flag.alt = "";
    flag.title = LANGUAGE_CATALOG[code]?.flagName || "";
    const label = document.createElement("span");
    label.className = "language-option-label";
    const name = document.createElement("span");
    name.textContent = languageName(code);
    label.append(name);
    // English and automatic detection do not need a duplicate subtitle.
    if (!["en", "auto"].includes(code)) {
      const native = document.createElement("small");
      native.textContent = LANGUAGES[code][1];
      label.append(native);
    }
    button.append(flag, label);
    if (selected) {
      const check = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      check.setAttribute("aria-hidden", "true");
      const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
      use.setAttribute("href", "#icon-check");
      check.append(use);
      button.append(check);
    }
    button.addEventListener("click", () => {
      const select = languageSelect,
        changed = select.value !== code;
      select.value = code;
      languageDialog.close();
      if (changed) select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    fragment.append(button);
  }
  languageOptions.replaceChildren(fragment);
  $("language-no-results").hidden = languageOptions.children.length > 0;
  $("language-no-results").textContent = t("languageNoResults");
  languageOptions.scrollTop = 0;
}
function updateLanguagePickerLabels() {
  for (const [select, trigger] of languageTriggers) {
    trigger.setAttribute(
      "aria-label",
      `${t(languagePickerTitle(select))} · ${languageName(select.value)}`
    );
    if (select.id === "interface-language") {
      const icon = document.createElement("span");
      icon.className = "menu-setting-icon";
      icon.innerHTML = '<svg aria-hidden="true"><use href="#icon-globe" /></svg>';
      const label = document.createElement("span");
      label.className = "menu-language-label";
      label.textContent = t("interfaceLanguage");
      const value = document.createElement("bdi");
      value.className = "menu-language-value";
      value.textContent = LANGUAGE_CATALOG[select.value]?.native || languageName(select.value);
      const arrow = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      arrow.setAttribute("aria-hidden", "true");
      arrow.classList.add("menu-language-arrow");
      const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
      use.setAttribute("href", "#icon-chevron");
      arrow.append(use);
      trigger.replaceChildren(icon, label, value, arrow);
    }
  }
  $("language-dialog-close").setAttribute("aria-label", t("closeLanguages"));
  languageSearch.placeholder = t("languageSearchHint");
  languageSearch.setAttribute("aria-label", t("searchLanguages"));
  if (languageSelect)
    $("language-dialog-title").textContent = t(languagePickerTitle(languageSelect));
  const count =
    mode === "image"
      ? Object.values(LANGUAGE_CATALOG).filter((entry) => entry.ocr).length
      : Object.keys(LANGUAGE_CATALOG).length;
  $("language-availability").textContent =
    t(
      languageSelect?.id === "interface-language"
        ? "interfaceLanguages"
        : mode === "image"
          ? "photoLanguages"
          : "languageQuality"
    ).replace(
      "{count}",
      languageSelect?.id === "interface-language" ? languageSelect.options.length : count
    ) +
    (mode === "live" && languageSelect?.id !== "interface-language"
      ? " " + t("liveLanguages")
      : "");
}
for (const select of [sourceEl, targetEl, $("interface-language")]) {
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className =
    select.id === "interface-language" ? "locale-button" : "language-picker-trigger";
  trigger.setAttribute("aria-haspopup", "dialog");
  trigger.setAttribute("aria-controls", "language-dialog");
  trigger.setAttribute("aria-expanded", "false");
  trigger.id = select.id === "interface-language" ? "ui-language" : `${select.id}-picker`;
  languageTriggers.set(select, trigger);
  select.hidden = true;
  select.parentElement.append(trigger);
  trigger.addEventListener("click", () => {
    languageSelect = select;
    languageSearch.value = "";
    updateLanguagePickerLabels();
    renderLanguageOptions();
    trigger.setAttribute("aria-expanded", "true");
    languageDialog.showModal();
    languageDialog.focus();
    // Preserve the selected row in long lists without opening the mobile keyboard.
    languageOptions.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  });
}
languageSearch.addEventListener("input", renderLanguageOptions);
$("language-dialog-close").addEventListener("click", () => languageDialog.close());
languageDialog.addEventListener("click", (event) => {
  if (event.target !== languageDialog) return;
  const bounds = languageDialog.getBoundingClientRect();
  if (
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom
  )
    languageDialog.close();
});
languageDialog.addEventListener("close", () => {
  if (languageSelect) {
    const trigger = languageTriggers.get(languageSelect);
    trigger.setAttribute("aria-expanded", "false");
    trigger.focus();
  }
  languageSelect = null;
});
languageDialog.addEventListener("keydown", (event) => {
  const buttons = [...languageOptions.children];
  if (!buttons.length || event.isComposing) return;
  const index = buttons.indexOf(document.activeElement);
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const step = event.key === "ArrowDown" ? 1 : -1;
    buttons[
      index < 0
        ? step > 0
          ? 0
          : buttons.length - 1
        : (index + step + buttons.length) % buttons.length
    ].focus();
  } else if (index >= 0 && ["Home", "End"].includes(event.key)) {
    event.preventDefault();
    buttons[event.key === "Home" ? 0 : buttons.length - 1].focus();
  } else if (event.key === "Enter" && document.activeElement === languageSearch) {
    event.preventDefault();
    buttons[0].click();
  }
});
document.addEventListener("languages:change", updateLanguagePickerLabels);
document.addEventListener("interface:change", () => {
  updateLanguagePickerLabels();
  if (languageDialog.open) renderLanguageOptions();
});
updateLanguagePickerLabels();
