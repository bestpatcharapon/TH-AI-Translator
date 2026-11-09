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
// These are installed-system font preferences, not downloadable web fonts.
// Only Latin/Thai are bundled; other scripts depend on the device's font coverage.
const interfaceFontGroups = {
  '"Noto Sans Arabic", "Geeza Pro", "Segoe UI", Tahoma': ["ar", "fa", "ps", "sd", "ur", "ug"],
  '"Noto Sans Hebrew", "Arial Hebrew", "Segoe UI", Arial': ["he", "yi"],
  '"Noto Sans Devanagari", "Kohinoor Devanagari", Mangal': ["hi", "mr", "ne", "sa"],
  '"Noto Sans Bengali", "Kohinoor Bangla", Vrinda': ["bn", "as"],
  '"Noto Sans Gujarati", "Gujarati Sangam MN", Shruti': ["gu"],
  '"Noto Sans Gurmukhi", "Gurmukhi MN", Raavi': ["pa"],
  '"Noto Sans Tamil", "Tamil Sangam MN", Latha': ["ta"],
  '"Noto Sans Telugu", "Telugu Sangam MN", Gautami': ["te"],
  '"Noto Sans Kannada", "Kannada Sangam MN", Tunga': ["kn"],
  '"Noto Sans Malayalam", "Malayalam Sangam MN", Kartika': ["ml"],
  '"Noto Sans Oriya", "Oriya Sangam MN", Kalinga': ["or"],
  '"Noto Sans Sinhala", "Sinhala Sangam MN", "Iskoola Pota"': ["si"],
  '"Noto Sans Myanmar", "Myanmar MN", "Myanmar Text"': ["my"],
  '"Noto Sans Khmer", "Khmer Sangam MN", "Leelawadee UI"': ["km"],
  '"Noto Sans Lao", "Lao Sangam MN", "Leelawadee UI"': ["lo"],
  '"Noto Sans Ethiopic", "Kefa", Nyala': ["am", "ti"],
  '"Noto Sans Armenian", "Mshtakan", "Segoe UI"': ["hy"],
  '"Noto Sans Georgian", "Arial", "Segoe UI"': ["ka"],
  '"Noto Serif Tibetan", "Kailasa", "Microsoft Himalaya"': ["bo"],
  '"Noto Sans Thaana", "MV Boli"': ["dv"],
  "var(--font-zh)": ["zh", "yue"],
  "var(--font-zh-tw)": ["zh-TW"],
  "var(--font-ja)": ["ja"],
  "var(--font-ko)": ["ko"],
};

function applyInterfaceFont(language) {
  const family = Object.entries(interfaceFontGroups).find(([, codes]) =>
    codes.includes(language)
  )?.[0];
  if (!family) {
    document.documentElement.style.removeProperty("--interface-font");
    return;
  }
  document.documentElement.style.setProperty("--interface-font", family);
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
