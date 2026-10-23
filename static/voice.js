/* Measure the existing microphone stream; never request or replay audio here. */
Object.assign(COPY.en, {
  micStart: "Dictate source text",
  micStop: "Stop recording",
  micOpening: "Opening microphone…",
});
Object.assign(COPY.th, {
  micStart: "พิมพ์ด้วยเสียง",
  micStop: "หยุดบันทึกเสียง",
  micOpening: "กำลังเปิดไมโครโฟน…",
});
const voiceButtons = [$("microphone"), $("live-mic-forward"), $("live-mic-reverse")];
const reducedVoiceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
let voiceContext = null,
  voiceSource = null,
  voiceAnalyser = null,
  voiceFrame = null,
  voiceClock = null;
let voiceState = "idle",
  voiceSide = false,
  voiceStarted = 0;
for (const button of voiceButtons) {
  const wave = document.createElement("span");
  wave.className = "mic-wave";
  wave.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 5; i++) {
    const bar = document.createElement("i");
    bar.style.setProperty("--bar-index", i);
    wave.append(bar);
  }
  const spinner = document.createElement("span");
  spinner.className = "mic-progress";
  spinner.setAttribute("aria-hidden", "true");
  button.append(wave, spinner);
}
const voiceElapsed = document.createElement("span");
voiceElapsed.className = "mic-elapsed";
voiceElapsed.setAttribute("aria-hidden", "true");
$("microphone").append(voiceElapsed);
function activeVoiceButtons() {
  return mode === "live"
    ? [$("microphone"), $(voiceSide ? "live-mic-reverse" : "live-mic-forward")]
    : [$("microphone")];
}
function stopVoiceMeter() {
  cancelAnimationFrame(voiceFrame);
  voiceFrame = null;
  clearInterval(voiceClock);
  voiceClock = null;
  voiceSource?.disconnect();
  voiceSource = null;
  voiceAnalyser = null;
  if (voiceContext) {
    voiceContext.close().catch(() => {});
    voiceContext = null;
  }
  voiceButtons.forEach((button) => {
    button.classList.remove("mic-measured");
    button
      .querySelectorAll(".mic-wave i")
      .forEach((bar) => bar.style.removeProperty("--voice-scale"));
  });
}
function updateVoiceLabels() {
  const button = $("microphone");
  const key =
    voiceState === "recording"
      ? "micStop"
      : voiceState === "transcribing"
        ? "transcribing"
        : voiceState === "requesting"
          ? "micOpening"
          : "micStart";
  button.setAttribute("aria-label", t(key));
  button.title = t(key);
}
function paintVoiceState() {
  for (const button of voiceButtons) {
    const state = activeVoiceButtons().includes(button) ? voiceState : "idle";
    button.dataset.voiceState = state;
    button.setAttribute("aria-busy", String(["requesting", "transcribing"].includes(state)));
  }
  updateVoiceLabels();
}
function startVoiceMeter(stream, onLevel) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  try {
    voiceContext = new AudioContextClass();
    voiceSource = voiceContext.createMediaStreamSource(stream);
    voiceAnalyser = voiceContext.createAnalyser();
    voiceAnalyser.fftSize = 256;
    voiceAnalyser.smoothingTimeConstant = 0.75;
    voiceSource.connect(voiceAnalyser);
    const bins = new Uint8Array(voiceAnalyser.frequencyBinCount),
      samples = new Float32Array(voiceAnalyser.fftSize);
    activeVoiceButtons().forEach((button) => button.classList.add("mic-measured"));
    const context = voiceContext;
    context.resume().catch(() => {
      if (voiceContext === context)
        activeVoiceButtons().forEach((button) => button.classList.remove("mic-measured"));
    });
    const draw = () => {
      if (!voiceAnalyser || voiceState !== "recording") return;
      voiceAnalyser.getByteFrequencyData(bins);
      voiceAnalyser.getFloatTimeDomainData(samples);
      const rms = Math.sqrt(samples.reduce((sum, value) => sum + value ** 2, 0) / samples.length);
      onLevel?.(rms);
      const level = Math.min(1, rms * 7);
      if (!reducedVoiceMotion.matches)
        activeVoiceButtons().forEach((button) =>
          button.querySelectorAll(".mic-wave i").forEach((bar, index) => {
            const frequency = bins[2 + index * 4] / 255;
            const scale = 0.15 + 0.85 * Math.min(1, level * 0.65 + frequency * 0.6);
            bar.style.setProperty("--voice-scale", scale.toFixed(3));
          })
        );
      voiceFrame = requestAnimationFrame(draw);
    };
    voiceFrame = requestAnimationFrame(draw);
  } catch {
    stopVoiceMeter();
  }
}
document.addEventListener("voice:state", ({ detail }) => {
  stopVoiceMeter();
  voiceState = detail.state;
  voiceSide = detail.reversed;
  paintVoiceState();
  if (voiceState !== "recording") return;
  voiceStarted = Date.now();
  const updateElapsed = () => {
    const seconds = Math.floor((Date.now() - voiceStarted) / 1000);
    voiceElapsed.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  };
  updateElapsed();
  startVoiceMeter(detail.stream, detail.onLevel);
  voiceClock = setInterval(updateElapsed, 1000);
});
document.addEventListener("interface:change", updateVoiceLabels);
window.addEventListener("pagehide", stopVoiceMeter);
paintVoiceState();
