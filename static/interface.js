/* Menu labels come only from bundled translations; AI is used for translation features. */
const interfaceSelect = $("interface-language"),
  interfaceStatus = $("interface-language-status"),
  interfaceStorageKey = "translator-interface-v1";
const bundledInterfaceLanguages = new Set(BUNDLED_INTERFACE_LANGUAGES);
const availableInterfaceLanguages = new Set(["en", "th", ...bundledInterfaceLanguages]);
let interfaceRequest = null;
for (const code of bundledInterfaceLanguages) {
  const entry = LANGUAGE_CATALOG[code];
  interfaceSelect.add(new Option(`${entry.name} · ${entry.native}`, code));
}
// Load script-specific fonts only when needed, using the app's existing font CDN.
const interfaceFontGroups = {
  "Noto Sans Arabic": ["ar", "fa", "ps", "sd", "ur", "ug"],
  "Noto Sans Hebrew": ["he", "yi"],
  "Noto Sans Devanagari": ["hi", "mr", "ne", "sa"],
  "Noto Sans Bengali": ["bn", "as"],
  "Noto Sans Gujarati": ["gu"],
  "Noto Sans Gurmukhi": ["pa"],
  "Noto Sans Tamil": ["ta"],
  "Noto Sans Telugu": ["te"],
  "Noto Sans Kannada": ["kn"],
  "Noto Sans Malayalam": ["ml"],
  "Noto Sans Oriya": ["or"],
  "Noto Sans Sinhala": ["si"],
  "Noto Sans Myanmar": ["my"],
  "Noto Sans Khmer": ["km"],
  "Noto Sans Lao": ["lo"],
  "Noto Sans Ethiopic": ["am", "ti"],
  "Noto Sans Armenian": ["hy"],
  "Noto Sans Georgian": ["ka"],
  "Noto Serif Tibetan": ["bo"],
  "Noto Sans Thaana": ["dv"],
  "Noto Sans SC": ["zh", "yue"],
  "Noto Sans TC": ["zh-TW"],
  "Noto Sans JP": ["ja"],
  "Noto Sans KR": ["ko"],
};
const loadedInterfaceFonts = new Set(["Noto Sans SC", "Noto Sans JP", "Noto Sans KR"]);
function applyInterfaceFont(language) {
  const family = Object.entries(interfaceFontGroups).find(([, codes]) =>
    codes.includes(language)
  )?.[0];
  if (!family) {
    document.documentElement.style.removeProperty("--interface-font");
    return;
  }
  if (!loadedInterfaceFonts.has(family)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?" +
      new URLSearchParams({ family: `${family}:wght@400;600`, display: "swap" });
    document.head.append(link);
    loadedInterfaceFonts.add(family);
  }
  document.documentElement.style.setProperty("--interface-font", `"${family}"`);
}
function validInterfaceTokens(value, original) {
  const pattern = /\{[^{}]+\}|\d+(?:[.,]\d+)*/g;
  const actual = JSON.stringify((value.match(pattern) || []).sort());
  const expected = original.match(pattern) || [];
  const optionalTwos = (original.match(/\btwo\b/gi) || []).length;
  return Array.from({ length: optionalTwos + 1 }, (_, count) =>
    JSON.stringify([...expected, ...Array(count).fill("2")].sort())
  ).includes(actual);
}
function validInterfaceCopy(strings) {
  return (
    strings &&
    typeof strings === "object" &&
    Object.keys(strings).length === Object.keys(COPY.en).length &&
    Object.entries(COPY.en).every(
      ([key, value]) =>
        typeof strings[key] === "string" &&
        (!value || strings[key].trim()) &&
        strings[key].length <= 6000 &&
        validInterfaceTokens(strings[key], value)
    )
  );
}
function storeInterfaceLanguage() {
  try {
    localStorage.setItem(interfaceStorageKey, JSON.stringify({ language: locale }));
  } catch {
    /* The chosen language still works for this session. */
  }
}
async function changeInterfaceLanguage(language, persist = true) {
  if (!availableInterfaceLanguages.has(language)) return;
  interfaceRequest?.abort();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  interfaceRequest = controller;
  // The picker shows the active language until the requested labels are ready.
  interfaceSelect.value = locale;
  updateLanguagePickerLabels();
  interfaceStatus.classList.remove("error");
  try {
    if (!COPY[language]) {
      interfaceStatus.textContent =
        t("interfaceLanguageLoading") + " · " + LANGUAGE_CATALOG[language].native;
      interfaceStatus.setAttribute("aria-busy", "true");
      const response = await fetch(
        `/static/interface-locales/${encodeURIComponent(language)}.json`,
        { signal: controller.signal }
      );
      if (!response.ok) throw new Error("Could not load interface language");
      const strings = await response.json();
      if (interfaceRequest !== controller) return;
      if (!validInterfaceCopy(strings)) throw new Error("Incomplete interface language");
      COPY[language] = strings;
    }
    if (interfaceRequest !== controller) return;
    interfaceSelect.value = language;
    applyInterfaceFont(language);
    applyInterfaceLocale(language);
    interfaceStatus.textContent = "";
    if (persist) storeInterfaceLanguage();
  } catch (error) {
    if (interfaceRequest !== controller) return;
    interfaceSelect.value = locale;
    updateLanguagePickerLabels();
    interfaceStatus.textContent = t(
      error.name === "AbortError" ? "interfaceLanguageTimeout" : "interfaceLanguageFailed"
    );
    interfaceStatus.classList.add("error");
  } finally {
    clearTimeout(timeout);
    if (interfaceRequest === controller) {
      interfaceRequest = null;
      interfaceStatus.removeAttribute("aria-busy");
    }
  }
}
interfaceSelect.addEventListener("change", () => changeInterfaceLanguage(interfaceSelect.value));
// Restore only the preference, never old AI-generated strings or provider cooldowns.
let savedInterface;
try {
  savedInterface = JSON.parse(localStorage.getItem(interfaceStorageKey) || "null");
  localStorage.removeItem("translator-interface-retry-at");
} catch {
  /* English default. */
}
changeInterfaceLanguage(
  availableInterfaceLanguages.has(savedInterface?.language) ? savedInterface.language : "en",
  false
);
