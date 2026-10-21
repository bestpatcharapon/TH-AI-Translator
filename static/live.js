/* Live conversation uses the shared translation, recording and speech services. */
Object.assign(COPY.en, {
  twoLanguage: "Uses up to 6 recent messages for context",
  typingIn: "Typing in",
  livePlaceholder: "Type a message…",
  expandMessage: "Expand message",
  listen: "Listen",
  backTranslator: "Back to translator",
  close: "Close",
  recordIn: "Record in",
  stopAndSend: "Stop recording and send",
  sameChatLanguage: "Choose two different languages for the conversation.",
});
Object.assign(COPY.th, {
  twoLanguage: "ใช้ 6 ข้อความล่าสุดช่วยเข้าใจบริบท",
  typingIn: "พิมพ์ภาษา",
  livePlaceholder: "พิมพ์ข้อความ…",
  expandMessage: "ขยายข้อความ",
  listen: "ฟังเสียง",
  backTranslator: "กลับหน้าแปลภาษา",
  close: "ปิด",
  recordIn: "บันทึกเสียงภาษา",
  stopAndSend: "หยุดบันทึกและส่ง",
  sameChatLanguage: "กรุณาเลือกสองภาษาที่ต่างกันสำหรับสนทนา",
});
const liveInputAnchor = document.createComment("Translation text input");
inputEl.before(liveInputAnchor);
const liveVoiceAnchor = document.createComment("Voice status");
$("voice-status").before(liveVoiceAnchor);
let liveOpen = false,
  expandedChatTurn = null;
function updateLiveControls() {
  for (const [id, code, reverse] of [
    ["live-mic-forward", sourceEl.value, false],
    ["live-mic-reverse", targetEl.value, true],
  ]) {
    const button = $(id),
      recording =
        mode === "live" &&
        $("microphone").getAttribute("aria-pressed") === "true" &&
        reverseSpeaker === reverse;
    button.querySelector("span").textContent = LANGUAGES[code][0];
    button.disabled = !LANGUAGE_CATALOG[code]?.transcribe;
    button.title = button.disabled ? t("microphoneUnavailable") : "";
    button.classList.toggle("selected", reverseSpeaker === reverse);
    button.setAttribute("aria-pressed", String(recording));
    button.setAttribute(
      "aria-label",
      recording ? t("stopAndSend") : `${t("recordIn")} ${LANGUAGES[code][0]}`
    );
  }
  $("live-audio").setAttribute("aria-pressed", String($("auto-speak").checked));
  $("live-audio").setAttribute("aria-label", t("autoSpeak"));
  $("live-audio").title = t("autoSpeak");
  $("live-back").setAttribute("aria-label", t("backTranslator"));
  $("clear-chat").setAttribute("aria-label", t("clearChat"));
  $("live-send").setAttribute("aria-label", t("send"));
  $("live-message-close").setAttribute("aria-label", t("close"));
  if (mode === "live") {
    inputEl.placeholder = t("livePlaceholder");
    inputEl.setAttribute("aria-label", `${t("typingIn")} ${LANGUAGES[activeLanguages()[0]][0]}`);
  }
}
function sizeLiveViewport() {
  if (window.visualViewport && window.visualViewport.scale === 1)
    document
      .querySelector(".translator")
      .style.setProperty("--live-height", `${window.visualViewport.height}px`);
}
window.visualViewport?.addEventListener("resize", sizeLiveViewport);
function refreshLiveMode() {
  const active = mode === "live";
  $("live-header").hidden = !active;
  if (active !== liveOpen) {
    if (active) {
      $("live-input-row").prepend(inputEl);
      inputEl.removeAttribute("aria-labelledby");
      $("live-status").after($("voice-status"));
    } else {
      liveInputAnchor.after(inputEl);
      inputEl.setAttribute("aria-labelledby", "source-heading");
      inputEl.removeAttribute("aria-label");
      liveVoiceAnchor.after($("voice-status"));
      if ($("live-message-dialog").open) $("live-message-dialog").close();
    }
    liveOpen = active;
    updateInput();
  }
  sizeLiveViewport();
  updateLiveControls();
}
document.addEventListener("mode:change", refreshLiveMode);
document.addEventListener("languages:change", updateLiveControls);
document.addEventListener("interface:change", updateLiveControls);
new MutationObserver(updateLiveControls).observe($("microphone"), {
  attributes: true,
  attributeFilter: ["aria-pressed"],
});
$("live-back").addEventListener("click", () =>
  document.querySelector('[data-mode="text"]').click()
);
$("live-audio").addEventListener("click", () => {
  $("auto-speak").checked = !$("auto-speak").checked;
  if (!$("auto-speak").checked) stopAudio();
  updateLiveControls();
});
$("live-send").addEventListener("click", () => {
  if (activeFeature().request || micStarting || recorder?.state === "recording") return;
  if (sourceEl.value === targetEl.value) {
    setStatus(t("sameChatLanguage"), true);
    return;
  }
  translate();
});
inputEl.addEventListener("keydown", (event) => {
  if (
    mode === "live" &&
    event.key === "Enter" &&
    !event.shiftKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.isComposing &&
    !composing
  ) {
    event.preventDefault();
    $("live-send").click();
  }
});
for (const [id, reverse] of [
  ["live-mic-forward", false],
  ["live-mic-reverse", true],
])
  $(id).addEventListener("click", () => {
    if (recorder?.state === "recording" && reverseSpeaker === reverse) {
      stopRecording();
      return;
    }
    if (sourceEl.value === targetEl.value) {
      setStatus(t("sameChatLanguage"), true);
      return;
    }
    $(reverse ? "speaker-reverse" : "speaker-forward").click();
    $("microphone").click();
  });
document.addEventListener("chat:expand", ({ detail: turn }) => {
  expandedChatTurn = turn;
  $("live-message-translation").textContent = turn.translation;
  $("live-message-translation").lang = turn.target;
  $("live-message-original").textContent = turn.text;
  $("live-message-original").lang = turn.source;
  $("live-message-direction").textContent =
    `${LANGUAGES[turn.source][0]} → ${LANGUAGES[turn.target][0]}`;
  $("live-message-dialog").showModal();
});
$("live-message-close").addEventListener("click", () => $("live-message-dialog").close());
$("live-message-speak").addEventListener("click", () => {
  if (expandedChatTurn)
    speak(expandedChatTurn.translation, expandedChatTurn.target, $("live-message-speak"));
});
$("live-message-copy").addEventListener("click", async () => {
  if (!expandedChatTurn) return;
  const turn = expandedChatTurn,
    epoch = modeEpoch;
  const copied = await copyText(turn.translation);
  if (
    mode === "live" &&
    modeEpoch === epoch &&
    expandedChatTurn === turn &&
    $("live-message-dialog").open
  ) {
    $("live-message-direction").textContent = t(copied ? "copied" : "copyFailed");
  }
});
$("live-message-dialog").addEventListener("close", () => {
  expandedChatTurn = null;
  stopAudio();
});
refreshLiveMode();
