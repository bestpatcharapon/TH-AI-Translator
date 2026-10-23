/* Private, feature-owned Thai interpretation; unknown meanings never become chat messages. */
Object.assign(COPY.en, {
  thaiMode: "Thai interpretation",
  thaiStandard: "Standard translation",
  thaiAuto: "Slang / dialect · unsure which",
  thaiSlang: "Slang & coined phrases",
  thaiNorthern: "Northern Thai",
  thaiIsan: "Isan",
  thaiSouthern: "Southern Thai",
  thaiAny: "Any Thai usage",
  thaiModeNote:
    "Up to 3,000 characters. AI interpretation can be wrong. Check microphone transcripts; this does not add a dialect-trained speech model.",
  thaiNeedContext: "More context is needed before translating this phrase.",
  thaiReviewTranscript:
    "Check or edit the heard text, then press Translate or Send to interpret it.",
  thaiClarification: "What does the speaker mean here?",
  thaiClarify: "Explain and translate again",
  thaiCentral: "Meaning in Central Thai",
  thaiUnconfirmed: "Possible meanings · not confirmed",
  thaiUseMeaning: "I mean this",
  thaiEvidence: "Wording and meaning",
  thaiPersonal: "Personal definition",
  thaiStarter: "Starter example",
  thaiLexicon: "My slang & dialect meanings",
  thaiLexiconHelp:
    "Personal definitions for Text or Live Chat, saved on this browser. Not shared or community-verified. Up to 30 per feature.",
  thaiTerm: "Word or phrase",
  thaiMeaning: "Meaning in Central Thai",
  thaiDialect: "Usage / dialect",
  thaiExample: "When is it used? (optional)",
  thaiSave: "Save meaning",
  thaiSaved: "Meaning saved for this feature.",
  thaiInvalid: "Enter a phrase, its meaning and usage. Up to 30 unique entries per feature.",
  thaiEdit: "Edit meaning",
  thaiEmpty: "No personal meanings yet.",
  thaiChecking: "Checking and saving…",
  thaiContextEmpty: "Explain the intended meaning first.",
  thaiExperimental: "AI interpretation · check the intended meaning with the speaker",
  thaiLearnMatched: "Definitions used as context",
});
Object.assign(COPY.th, {
  thaiMode: "ตีความภาษาไทย",
  thaiStandard: "แปลปกติ",
  thaiAuto: "สแลง / ภาษาถิ่น · ไม่แน่ใจถิ่น",
  thaiSlang: "สแลงและคำที่สร้างใหม่",
  thaiNorthern: "ภาษาเหนือ",
  thaiIsan: "ภาษาอีสาน",
  thaiSouthern: "ภาษาใต้",
  thaiAny: "ใช้กับภาษาไทยทุกแบบ",
  thaiModeNote:
    "รองรับ 3,000 ตัวอักษร AI อาจตีความผิด ควรตรวจข้อความจากไมค์ก่อน ระบบนี้ยังไม่ได้เพิ่มโมเดลเสียงที่ฝึกเฉพาะภาษาถิ่น",
  thaiNeedContext: "ต้องการบริบทเพิ่มก่อนแปลคำนี้",
  thaiReviewTranscript: "ตรวจหรือแก้ข้อความที่ได้ยินก่อน แล้วกดแปลหรือส่งเพื่อตีความ",
  thaiClarification: "ผู้พูดต้องการสื่อความหมายว่าอะไรในประโยคนี้?",
  thaiClarify: "อธิบายแล้วแปลใหม่",
  thaiCentral: "ความหมายเป็นไทยกลาง",
  thaiUnconfirmed: "ความหมายที่เป็นไปได้ · ยังไม่ยืนยัน",
  thaiUseMeaning: "หมายถึงแบบนี้",
  thaiEvidence: "คำในต้นฉบับและความหมาย",
  thaiPersonal: "ความหมายที่คุณบันทึก",
  thaiStarter: "ตัวอย่างเริ่มต้น",
  thaiLexicon: "คลังสแลงและความหมายภาษาถิ่นของฉัน",
  thaiLexiconHelp:
    "บันทึกแยก Text / Live Chat บนเบราว์เซอร์นี้ สูงสุดฟีเจอร์ละ 30 คำ ไม่ได้แชร์หรือรับรองโดยชุมชน",
  thaiTerm: "คำหรือวลี",
  thaiMeaning: "ความหมายเป็นไทยกลาง",
  thaiDialect: "การใช้ / ภาษาถิ่น",
  thaiExample: "ใช้ในสถานการณ์ไหน? (ไม่บังคับ)",
  thaiSave: "บันทึกความหมาย",
  thaiSaved: "บันทึกความหมายสำหรับฟีเจอร์นี้แล้ว",
  thaiInvalid: "ระบุคำ ความหมาย และการใช้ให้ครบ บันทึกได้สูงสุด 30 คำที่ไม่ซ้ำกันต่อฟีเจอร์",
  thaiEdit: "แก้ความหมาย",
  thaiEmpty: "ยังไม่มีความหมายที่คุณบันทึก",
  thaiChecking: "กำลังตรวจและบันทึก…",
  thaiContextEmpty: "กรุณาอธิบายความหมายที่ต้องการก่อน",
  thaiExperimental: "AI ช่วยตีความ · ควรตรวจความหมายกับผู้พูด",
  thaiLearnMatched: "ความหมายที่นำมาใช้เป็นบริบท",
});
const thaiState = () => activeFeature().thai;
const thaiModeKeys = {
  auto: "thaiAuto",
  slang: "thaiSlang",
  northern: "thaiNorthern",
  isan: "thaiIsan",
  southern: "thaiSouthern",
};
const thaiNode = (tag, text, className = "") => {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
};
function validThaiLexicon(entries) {
  if (!Array.isArray(entries) || entries.length > 30) return false;
  const seen = new Set();
  return entries.every((entry) => {
    if (!entry || !Object.hasOwn(thaiModeKeys, entry.dialect)) return false;
    for (const [key, limit] of [
      ["term", 120],
      ["meaning", 500],
      ["example", 300],
    ]) {
      const value = entry[key];
      if (
        typeof value !== "string" ||
        value.length > limit ||
        (key !== "example" && !value.trim()) ||
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
      )
        return false;
    }
    const key = JSON.stringify([entry.term.trim().toLocaleLowerCase(), entry.dialect]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
for (const [name, workspace] of featureWorkspaces) {
  try {
    const entries = JSON.parse(localStorage.getItem(`translator-thai-lexicon-v1:${name}`) || "[]");
    if (validThaiLexicon(entries)) workspace.thai.lexicon = entries;
  } catch {
    /* Corrupt or unavailable storage does not stop translation. */
  }
}
function thaiSnapshotOptions(snapshot) {
  if (!snapshot.thai_mode || snapshot.thai_mode === "standard") return {};
  return {
    thai_mode: snapshot.thai_mode,
    thai_lexicon: snapshot.thai_lexicon || [],
    thai_clarification: snapshot.thai_clarification || "",
    interface_language: locale,
  };
}
function thaiTranslationOptions() {
  const state = thaiState();
  if (state.clarificationSource !== inputEl.value.trim()) state.clarification = "";
  if (
    !["text", "live"].includes(mode) ||
    !["th", "auto"].includes(activeLanguages()[0]) ||
    state.mode === "standard"
  )
    return {};
  return {
    thai_mode: state.mode,
    thai_lexicon: state.lexicon.map((entry) => ({ ...entry })),
    thai_clarification: state.clarification,
    interface_language: locale,
  };
}
function renderThai() {
  const state = thaiState(),
    available = ["text", "live"].includes(mode),
    eligible = available && ["th", "auto"].includes(activeLanguages()[0]);
  $("thai-tools").hidden = !eligible;
  document
    .querySelector(".translator")
    .classList.toggle("thai-interpreting", eligible && state.mode !== "standard");
  $("thai-lexicon-editor").hidden = !available;
  $("thai-mode").value = state.mode;
  $("thai-mode-note").hidden = state.mode === "standard";
  const result = state.result,
    visible = eligible && state.mode !== "standard" && !!result;
  $("thai-result").hidden = !visible;
  $("thai-result-content").replaceChildren();
  $("thai-clarification-form").hidden = !visible || result.status !== "needs_context";
  $("thai-clarification").value = state.clarification;
  if (!visible) return;
  const content = $("thai-result-content");
  content.append(
    thaiNode("h3", t(result.status === "needs_context" ? "thaiNeedContext" : "thaiCentral"))
  );
  if (result.standard_thai) {
    const meaning = thaiNode("p", result.standard_thai, "thai-central");
    meaning.lang = "th";
    content.append(meaning);
  }
  content.append(
    thaiNode("p", result.note, "menu-help"),
    thaiNode("small", t("thaiExperimental"), "menu-help")
  );
  for (const question of result.questions) content.append(thaiNode("p", question, "thai-question"));
  if (result.possibilities.length) content.append(thaiNode("h4", t("thaiUnconfirmed")));
  for (const possibility of result.possibilities) {
    const row = thaiNode("div", "", "thai-possibility"),
      button = thaiNode("button", t("thaiUseMeaning"), "outline-button");
    button.type = "button";
    button.addEventListener("click", () => {
      state.clarification = possibility.meaning;
      state.clarificationSource = inputEl.value.trim();
      $("thai-clarification").value = state.clarification;
      $("thai-clarification-form").requestSubmit();
    });
    row.append(thaiNode("p", possibility.meaning), thaiNode("small", possibility.reason), button);
    content.append(row);
  }
  if (result.evidence.length || result.matched_entries.length) {
    const details = thaiNode("details", ""),
      summary = thaiNode("summary", t("thaiEvidence"));
    details.append(summary);
    for (const item of result.evidence)
      details.append(thaiNode("p", `${item.quote} → ${item.meaning}`));
    for (const item of result.matched_entries)
      details.append(
        thaiNode(
          "p",
          `${t(item.origin === "personal" ? "thaiPersonal" : "thaiStarter")}: ${item.term} → ${item.meaning}`
        )
      );
    content.append(details);
  }
}
function renderThaiLexicon() {
  const state = thaiState();
  for (const [id, key] of [
    ["thai-term", "term"],
    ["thai-meaning", "meaning"],
    ["thai-term-dialect", "dialect"],
    ["thai-example", "example"],
  ])
    $(id).value = state.draft[key];
  $("thai-save").disabled = !!state.request;
  $("thai-lexicon-list").replaceChildren();
  if (!state.lexicon.length)
    $("thai-lexicon-list").append(thaiNode("p", t("thaiEmpty"), "menu-help"));
  for (const entry of state.lexicon) {
    const row = thaiNode("article", "", "thai-lexicon-entry");
    row.append(
      thaiNode("strong", entry.term),
      thaiNode("p", entry.meaning),
      thaiNode(
        "small",
        `${t(thaiModeKeys[entry.dialect])}${entry.example ? " · " + entry.example : ""}`
      )
    );
    const edit = thaiNode("button", t("thaiEdit"), "text-button");
    edit.type = "button";
    edit.disabled = !!state.request;
    edit.addEventListener("click", () => {
      state.draft = { ...entry };
      renderThaiLexicon();
      $("thai-meaning").focus();
    });
    const remove = thaiNode("button", t("deleteTranslation"), "text-button");
    remove.type = "button";
    remove.disabled = !!state.request;
    remove.addEventListener("click", () =>
      saveThaiLexicon(state.lexicon.filter((item) => item !== entry))
    );
    row.append(edit, remove);
    $("thai-lexicon-list").append(row);
  }
}
async function saveThaiLexicon(entries) {
  if (!validThaiLexicon(entries)) {
    featureStatus("thai-lexicon-status", t("thaiInvalid"), true);
    return;
  }
  const workspace = activeFeature(),
    state = thaiState(),
    epoch = modeEpoch,
    controller = new AbortController();
  state.request?.abort();
  state.request = controller;
  renderThaiLexicon();
  featureStatus("thai-lexicon-status", t("thaiChecking"));
  const owns = () =>
    activeFeature() === workspace && modeEpoch === epoch && state.request === controller;
  try {
    const data = await responseJson(
      await fetch("/api/thai-lexicon/validate", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      })
    );
    if (!owns()) return;
    localStorage.setItem(`translator-thai-lexicon-v1:${mode}`, JSON.stringify(data.entries));
    state.lexicon = data.entries;
    state.draft = { term: "", meaning: "", dialect: state.draft.dialect, example: "" };
    featureStatus("thai-lexicon-status", t("thaiSaved"));
    if (state.mode !== "standard") document.dispatchEvent(new CustomEvent("translation:settings"));
  } catch (error) {
    if (error.name !== "AbortError" && owns())
      featureStatus("thai-lexicon-status", error.message || t("saveFailed"), true);
  } finally {
    if (owns()) {
      state.request = null;
      renderThaiLexicon();
    }
  }
}
$("thai-mode").addEventListener("change", () => {
  thaiState().mode = $("thai-mode").value;
  thaiState().clarification = "";
  document.dispatchEvent(new CustomEvent("translation:settings"));
  renderThai();
});
$("thai-clarification").addEventListener("input", () => {
  thaiState().clarification = $("thai-clarification").value;
  thaiState().clarificationSource = inputEl.value.trim();
});
$("thai-clarification-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!thaiState().clarification.trim()) {
    setStatus(t("thaiContextEmpty"), true);
    return;
  }
  if (activeFeature().request) return;
  invalidateTranslation();
  translate();
});
for (const [id, key] of [
  ["thai-term", "term"],
  ["thai-meaning", "meaning"],
  ["thai-term-dialect", "dialect"],
  ["thai-example", "example"],
])
  $(id).addEventListener(id === "thai-term-dialect" ? "change" : "input", () => {
    thaiState().draft[key] = $(id).value;
  });
$("thai-lexicon-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const state = thaiState(),
    entry = { ...state.draft };
  entry.term = entry.term.trim();
  entry.meaning = entry.meaning.trim();
  entry.example = entry.example.trim();
  const entries = state.lexicon.filter(
    (item) =>
      !(
        item.term.toLocaleLowerCase() === entry.term.toLocaleLowerCase() &&
        item.dialect === entry.dialect
      )
  );
  saveThaiLexicon([...entries, entry]);
});
inputEl.addEventListener("input", () => {
  thaiState().clarification = "";
});
document.addEventListener("thai:result", ({ detail }) => {
  thaiState().result = detail;
  renderThai();
});
document.addEventListener("translation:complete", ({ detail }) => {
  thaiState().result = detail.interpretation || null;
  renderThai();
});
document.addEventListener("translation:invalidated", () => {
  thaiState().result = null;
  renderThai();
});
document.addEventListener("languages:change", renderThai);
document.addEventListener("mode:leaving", () => {
  thaiState().request?.abort();
  thaiState().request = null;
});
document.addEventListener("mode:restored", () => {
  featureStatus("thai-lexicon-status");
  renderThai();
  renderThaiLexicon();
});
document.addEventListener("interface:change", () => {
  renderThai();
  renderThaiLexicon();
});
document.addEventListener("menu:open", () => {
  featureStatus("thai-lexicon-status");
  renderThaiLexicon();
});
renderThai();
renderThaiLexicon();
