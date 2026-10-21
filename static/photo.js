/* Photo translation keeps the original pixels and draws positioned translated labels. */
Object.assign(COPY.en, {
  photoEyebrow: "AI PHOTO TRANSLATION",
  photoTitle: "Translate text in photos",
  photoIntro: "Snap or choose a menu, sign or document and see the translation right on the photo.",
  photoChoose: "Choose image",
  photoCamera: "Use camera",
  photoHelp: "Choose a photo and see its translation on the image.",
  photoFormats: "PNG, JPEG, WebP · up to 10 MB",
  photoOriginal: "Original photo",
  photoTranslated: "Translated photo",
  photoFullscreen: "Full screen",
  photoChange: "Change photo",
  photoRemove: "Remove photo",
  photoDownload: "Download translated image",
  photoProcessing: "Reading and translating your photo…",
  photoDone: "Translation is on the photo. Tap a label or open full screen to read it.",
  photoCapture: "Take photo",
  photoCameraLoading: "Opening camera…",
  photoCameraError:
    "Could not open the camera. Allow camera access and use HTTPS or localhost, or choose an image instead.",
  photoDownloadError: "Could not download the image. Please try again.",
});
Object.assign(COPY.th, {
  photoEyebrow: "แปลข้อความบนภาพด้วย AI",
  photoTitle: "แปลข้อความทับบนรูปภาพ",
  photoIntro: "ถ่ายหรือเลือกรูปเมนู ป้าย หรือเอกสาร แล้วดูคำแปลบนรูปเดิมได้ทันที",
  photoChoose: "เลือกรูปภาพ",
  photoCamera: "ใช้กล้อง",
  photoHelp: "เลือกรูป แล้วดูคำแปลที่วางบนข้อความในภาพ",
  photoFormats: "PNG, JPEG, WebP · สูงสุด 10 MB",
  photoOriginal: "รูปต้นฉบับ",
  photoTranslated: "รูปที่แปลแล้ว",
  photoFullscreen: "เต็มหน้าจอ",
  photoChange: "เปลี่ยนรูป",
  photoRemove: "นำรูปออก",
  photoDownload: "ดาวน์โหลดรูปที่แปลแล้ว",
  photoProcessing: "กำลังอ่านข้อความและแปลบนภาพ…",
  photoDone: "แปลบนรูปแล้ว กดข้อความหรือเปิดเต็มจอเพื่ออ่านให้ชัดขึ้น",
  photoCapture: "ถ่ายภาพ",
  photoCameraLoading: "กำลังเปิดกล้อง…",
  photoCameraError:
    "เปิดกล้องไม่ได้ กรุณาอนุญาตสิทธิ์และใช้ HTTPS หรือ localhost หรือเลือกรูปจากอุปกรณ์แทน",
  photoDownloadError: "ดาวน์โหลดรูปไม่สำเร็จ กรุณาลองอีกครั้ง",
});
let photoFile = null,
  photoData = null,
  photoUrl = null,
  photoRequest = null,
  photoTimer = null;
let photoEpoch = 0,
  photoDownloadEpoch = 0,
  showingOriginal = false,
  photoZoom = 1,
  photoActiveLabel = null;
let cameraStream = null,
  cameraEpoch = 0,
  cameraTimer = null;
let previousPhotoMode = mode;
let photoLoadingClock = null,
  photoRetryClock = null;
let photoLastError = null,
  pausedPhotoError = null;
const PHOTO_TIMEOUT_MS = 90000;
Object.assign(COPY.en, {
  photoCancel: "Cancel",
  photoNotCompleted: "Translation not completed",
  photoRateLimited: "The AI service has reached its usage limit. Wait a moment, then try again.",
  photoRetryWait: "Try again in {seconds} seconds",
  photoElapsed: "{seconds}s elapsed",
  photoSlow: "Photos with many labels can take longer.",
  photoTimeout:
    "This photo took too long to translate. Select the source language or use a smaller photo, then try again.",
  photoCanceled: "Translation canceled. Your photo is still here; you can try again.",
});
Object.assign(COPY.th, {
  photoCancel: "ยกเลิก",
  photoNotCompleted: "ยังแปลรูปไม่สำเร็จ",
  photoRateLimited: "บริการ AI ถึงขีดจำกัดการใช้งานชั่วคราว กรุณารอก่อนลองอีกครั้ง",
  photoRetryWait: "ลองใหม่ได้ใน {seconds} วินาที",
  photoElapsed: "ผ่านไป {seconds} วินาที",
  photoSlow: "รูปที่มีข้อความหลายส่วนอาจใช้เวลานานขึ้น",
  photoTimeout:
    "การแปลรูปใช้เวลานานเกินไป กรุณาเลือกภาษาต้นทางให้ตรงกับรูป หรือใช้รูปที่เล็กลงแล้วลองใหม่",
  photoCanceled: "ยกเลิกการแปลแล้ว รูปของคุณยังอยู่ สามารถกดลองใหม่ได้",
});
function clearPhotoError() {
  photoLastError = null;
  clearInterval(photoRetryClock);
  photoRetryClock = null;
  $("photo-error").hidden = true;
  $("photo-retry").hidden = true;
  $("photo-retry").disabled = false;
  $("photo-retry-wait").textContent = "";
}
function showPhotoError(message, retryAfter = 0, isError = true) {
  clearPhotoError();
  photoStatus(message, isError);
  $("photo-error").hidden = false;
  $("photo-error-message").textContent = message;
  $("photo-retry").hidden = false;
  const seconds = Number.isFinite(retryAfter)
    ? Math.max(0, Math.min(3600, Math.ceil(retryAfter)))
    : 0;
  const readyAt = Date.now() + seconds * 1000;
  photoLastError = { message, readyAt, isError };
  const update = () => {
    const remaining = Math.max(0, Math.ceil((readyAt - Date.now()) / 1000));
    $("photo-retry").disabled = remaining > 0;
    $("photo-retry-wait").textContent = remaining
      ? t("photoRetryWait").replace("{seconds}", String(remaining))
      : "";
    if (!remaining) {
      clearInterval(photoRetryClock);
      photoRetryClock = null;
    }
  };
  update();
  if (seconds) photoRetryClock = setInterval(update, 1000);
  $("photo-error").scrollIntoView({ block: "nearest" });
}
function startPhotoClock() {
  clearInterval(photoLoadingClock);
  const started = Date.now();
  const update = () => {
    const elapsed = Math.floor((Date.now() - started) / 1000);
    $("photo-elapsed").textContent =
      t("photoElapsed").replace("{seconds}", String(elapsed)) +
      (elapsed >= 20 ? ` · ${t("photoSlow")}` : "");
  };
  update();
  photoLoadingClock = setInterval(update, 1000);
}
const stageObservers = new Map();
const photoSettings = () =>
  JSON.stringify([sourceEl.value, targetEl.value, $("tone").value, translationOptions()]);
let completedPhotoSettings = "";
function photoStatus(message = "", error = false) {
  $("photo-status").textContent = message;
  $("photo-status").classList.toggle("error", error);
}
function cancelPhotoRequest() {
  photoDownloadEpoch++;
  $("photo-download").disabled = false;
  clearInterval(photoLoadingClock);
  photoLoadingClock = null;
  clearPhotoError();
  clearTimeout(photoTimer);
  photoTimer = null;
  photoEpoch++;
  photoRequest?.abort();
  photoRequest = null;
  $("photo-loading").hidden = true;
  $("photo-mode").setAttribute("aria-busy", "false");
}
function setPhotoBusy(busy) {
  $("photo-loading").hidden = !busy;
  $("photo-mode").setAttribute("aria-busy", String(busy));
  $("photo-original").disabled = !photoData;
  $("photo-fullscreen").disabled = !photoFile;
  $("photo-download").hidden = !photoData || busy;
}
function labelRect(region, regions, width, height) {
  let left = region.x,
    right = region.x + region.width;
  const center = (left + right) / 2;
  if (region.width < width * 0.13 && region.height < height * 0.08) {
    const desired = Math.max(region.width, width * 0.095);
    left = center - desired / 2;
    right = center + desired / 2;
  }
  for (const other of regions) {
    if (other === region) continue;
    const overlapY =
      Math.min(region.y + region.height, other.y + other.height) - Math.max(region.y, other.y);
    if (overlapY > Math.min(region.height, other.height) * 0.4) {
      const otherCenter = other.x + other.width / 2;
      if (otherCenter < center) left = Math.max(left, (other.x + other.width + region.x) / 2);
      else if (otherCenter > center)
        right = Math.min(right, (region.x + region.width + other.x) / 2);
    }
  }
  let bottom = region.y + region.height * (region.height < height * 0.08 ? 1.65 : 1.05);
  for (const other of regions) {
    if (
      other !== region &&
      other.y > region.y + region.height &&
      other.x < right &&
      other.x + other.width > left
    )
      bottom = Math.min(bottom, other.y - 2);
  }
  left = Math.max(0, Math.min(region.x, left));
  right = Math.min(width, Math.max(region.x + region.width, right));
  return {
    x: left,
    y: region.y,
    width: Math.max(1, right - left),
    height: Math.max(region.height, Math.min(height, bottom) - region.y),
  };
}
function fitPhotoLabel(button, originalHeight) {
  const content = button.firstElementChild;
  let size = Math.min(42, Math.max(8, originalHeight * 0.85));
  button.style.fontSize = `${size}px`;
  while (
    size > 6 &&
    (content.scrollHeight > button.clientHeight - 2 || content.scrollWidth > button.clientWidth - 4)
  ) {
    size -= 0.5;
    button.style.fontSize = `${size}px`;
  }
  button.dataset.fontSize = String(size);
}
function renderPhotoStage(id) {
  const stage = $(id);
  stageObservers.get(id)?.disconnect();
  stageObservers.delete(id);
  stage.replaceChildren();
  const src = photoData?.image || photoUrl;
  if (!src) return;
  const image = document.createElement("img");
  image.src = src;
  image.alt = t(photoData && !showingOriginal ? "photoTranslated" : "photoOriginal");
  stage.append(image);
  if (!photoData || showingOriginal) return;
  const data = photoData;
  const overlay = document.createElement("div");
  overlay.className = "photo-overlay";
  overlay.style.width = `${data.width}px`;
  overlay.style.height = `${data.height}px`;
  const labels = [];
  for (const region of data.regions) {
    if (
      /^[\d\s.,+()/-]+$/.test(region.translation) &&
      region.translation.trim() === region.text.trim()
    )
      continue;
    const rect = labelRect(region, data.regions, data.width, data.height);
    const label = document.createElement("button");
    label.type = "button";
    label.className = "photo-label";
    label.style.left = `${rect.x}px`;
    label.style.top = `${rect.y}px`;
    label.style.width = `${rect.width}px`;
    label.style.height = `${rect.height}px`;
    label.style.background = region.background;
    label.style.color = region.foreground;
    label.lang = data.target_language;
    label.setAttribute("aria-label", region.translation);
    label.title = region.translation;
    const content = document.createElement("span");
    content.textContent = region.translation;
    label.append(content);
    label.addEventListener("click", () => {
      photoActiveLabel = region;
      $("photo-label-text").textContent = region.translation;
      $("photo-label-text").lang = data.target_language;
      $("photo-label-status").textContent = "";
      $("photo-label-dialog").showModal();
    });
    overlay.append(label);
    labels.push([label, region]);
  }
  stage.append(overlay);
  const resize = () => {
    overlay.style.transform = `scale(${stage.clientWidth / data.width})`;
    labels.forEach(([label, region]) => fitPhotoLabel(label, region.height));
  };
  image.addEventListener("load", resize);
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(stage);
  stageObservers.set(id, observer);
  document.fonts.ready.then(() => {
    if (photoData === data && stage.contains(overlay)) resize();
  });
}
function renderPhoto() {
  $("photo-empty").hidden = !!photoFile;
  $("photo-result").hidden = !photoFile;
  renderPhotoStage("photo-main-stage");
  if ($("photo-viewer").open) renderPhotoStage("photo-viewer-stage");
  $("photo-original").setAttribute("aria-pressed", String(showingOriginal));
  $("photo-original").querySelector("span").textContent = t(
    showingOriginal ? "photoTranslated" : "photoOriginal"
  );
  $("photo-viewer-original").textContent = t(showingOriginal ? "photoTranslated" : "photoOriginal");
  $("photo-original").disabled = !photoData;
  $("photo-download").hidden = !photoData;
}
async function importPhoto(file) {
  if (file.size > 10 * 1024 * 1024) {
    photoStatus(t("fileTooLarge"), true);
    return;
  }
  if (!/image\/(png|jpeg|webp)/i.test(file.type) && !/\.(png|jpe?g|webp)$/i.test(file.name)) {
    photoStatus(t("fileUnsupported"), true);
    return;
  }
  if (mode !== "image") return;
  cancelPhotoRequest();
  stopAudio();
  stopRecording(true);
  if (photoUrl) URL.revokeObjectURL(photoUrl);
  photoFile = file;
  photoUrl = URL.createObjectURL(file);
  photoData = null;
  showingOriginal = false;
  completedPhotoSettings = "";
  $("photo-retry").hidden = true;
  renderPhoto();
  await translatePhoto();
}
async function translatePhoto() {
  if (!photoFile || mode !== "image") return;
  cancelPhotoRequest();
  const epoch = photoEpoch,
    controller = new AbortController();
  photoRequest = controller;
  photoData = null;
  showingOriginal = false;
  renderPhoto();
  setPhotoBusy(true);
  startPhotoClock();
  photoStatus(t("photoProcessing"));
  $("photo-retry").hidden = true;
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, PHOTO_TIMEOUT_MS);
  const options = translationOptions(),
    tone = $("tone").value;
  const signature = photoSettings(),
    form = new FormData();
  form.append("file", photoFile);
  form.append("source", sourceEl.value);
  form.append("target", targetEl.value);
  form.append("tone", tone);
  form.append("context", options.context);
  form.append("extra_context", options.extra_context);
  form.append("additional_targets", JSON.stringify(options.additional_targets));
  form.append("glossary", JSON.stringify(options.glossary));
  document.dispatchEvent(new CustomEvent("additional:clear"));
  try {
    const data = await responseJson(
      await fetch("/api/photo-translate", { method: "POST", body: form, signal: controller.signal })
    );
    if (epoch !== photoEpoch || mode !== "image") return;
    photoData = data;
    completedPhotoSettings = signature;
    renderPhoto();
    photoStatus(t("photoDone"));
    document.dispatchEvent(
      new CustomEvent("history:record", {
        detail: {
          feature: "image",
          text: data.regions.map((region) => region.text).join("\n"),
          translation: data.regions.map((region) => region.translation).join("\n"),
          source: data.source_language,
          sourceLanguage: data.source_language,
          target: targetEl.value,
          tone,
          ...options,
          audit: data.audit || null,
          additional_translations: data.additional_translations || [],
        },
      })
    );
  } catch (error) {
    if (epoch === photoEpoch && mode === "image") {
      if (timedOut) showPhotoError(t("photoTimeout"));
      else if (error.name !== "AbortError")
        showPhotoError(
          error.status === 429 ? t("photoRateLimited") : error.message || t("failed"),
          error.status === 429 ? error.retryAfter || 60 : 0
        );
    }
  } finally {
    clearTimeout(timeout);
    if (epoch === photoEpoch) {
      clearInterval(photoLoadingClock);
      photoLoadingClock = null;
      photoRequest = null;
      setPhotoBusy(false);
    }
  }
}
function clearPhoto() {
  cancelPhotoRequest();
  closePhotoCamera();
  stopAudio();
  document.dispatchEvent(new CustomEvent("additional:clear"));
  if (photoUrl) URL.revokeObjectURL(photoUrl);
  photoUrl = null;
  photoFile = null;
  photoData = null;
  showingOriginal = false;
  completedPhotoSettings = "";
  $("photo-file-input").value = "";
  $("photo-retry").hidden = true;
  for (const id of ["photo-viewer", "photo-label-dialog"]) if ($(id).open) $(id).close();
  photoStatus();
  renderPhoto();
}
$("photo-choose").addEventListener("click", () => $("photo-file-input").click());
$("photo-change").addEventListener("click", () => $("photo-file-input").click());
$("photo-file-input").addEventListener("change", () => {
  const file = $("photo-file-input").files[0];
  if (file) importPhoto(file);
  $("photo-file-input").value = "";
});
$("photo-cancel").addEventListener("click", () => {
  cancelPhotoRequest();
  setPhotoBusy(false);
  showPhotoError(t("photoCanceled"), 0, false);
});
$("photo-remove").addEventListener("click", clearPhoto);
$("photo-retry").addEventListener("click", translatePhoto);
for (const id of ["photo-original", "photo-viewer-original"])
  $(id).addEventListener("click", () => {
    if (photoData) {
      showingOriginal = !showingOriginal;
      renderPhoto();
    }
  });
for (const name of ["dragenter", "dragover", "dragleave", "drop"])
  $("photo-mode").addEventListener(name, (event) => {
    event.preventDefault();
    if (name === "drop" && event.dataTransfer.files[0]) importPhoto(event.dataTransfer.files[0]);
  });
function sizePhotoViewer() {
  const width = Math.min(photoData?.width || 1400, $("photo-viewer-scroll").clientWidth - 24);
  $("photo-viewer-stage").style.width = `${Math.max(1, width * photoZoom)}px`;
  $("photo-zoom-level").textContent = `${Math.round(photoZoom * 100)}%`;
}
$("photo-fullscreen").addEventListener("click", () => {
  if (!photoFile) return;
  photoZoom = 1;
  $("photo-viewer").showModal();
  sizePhotoViewer();
  renderPhotoStage("photo-viewer-stage");
});
$("photo-viewer-close").addEventListener("click", () => $("photo-viewer").close());
for (const [id, step] of [
  ["photo-zoom-in", 0.5],
  ["photo-zoom-out", -0.5],
])
  $(id).addEventListener("click", () => {
    photoZoom = Math.min(6, Math.max(0.5, photoZoom + step));
    sizePhotoViewer();
  });
window.addEventListener("resize", () => {
  if ($("photo-viewer").open) sizePhotoViewer();
});
$("photo-label-close").addEventListener("click", () => $("photo-label-dialog").close());
$("photo-label-copy").addEventListener("click", async () => {
  if (!photoActiveLabel) return;
  const label = photoActiveLabel,
    epoch = modeEpoch;
  const copied = await copyText(label.translation);
  if (
    mode === "image" &&
    modeEpoch === epoch &&
    photoActiveLabel === label &&
    $("photo-label-dialog").open
  ) {
    $("photo-label-status").textContent = t(copied ? "copied" : "copyFailed");
  }
});
$("photo-label-speak").addEventListener("click", () => {
  if (photoActiveLabel && photoData)
    speak(photoActiveLabel.translation, photoData.target_language, $("photo-label-speak"));
});
function wrapPhotoText(context, text, maxWidth) {
  const lines = [];
  let line = "";
  for (const char of text) {
    if (char === "\n" || (line && context.measureText(line + char).width > maxWidth)) {
      lines.push(line.trim());
      line = char === "\n" ? "" : char;
    } else line += char;
  }
  if (line) lines.push(line.trim());
  return lines;
}
$("photo-download").addEventListener("click", async () => {
  if (!photoData) return;
  const data = photoData,
    epoch = modeEpoch,
    token = ++photoDownloadEpoch;
  const ownsDownload = () =>
    mode === "image" && modeEpoch === epoch && photoData === data && photoDownloadEpoch === token;
  const button = $("photo-download");
  button.disabled = true;
  try {
    await document.fonts.ready;
    if (!ownsDownload()) return;
    const image = new Image();
    image.src = data.image;
    await image.decode();
    if (!ownsDownload()) return;
    const canvas = document.createElement("canvas");
    canvas.width = data.width;
    canvas.height = data.height;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0);
    for (const region of data.regions) {
      if (
        /^[\d\s.,+()/-]+$/.test(region.translation) &&
        region.translation.trim() === region.text.trim()
      )
        continue;
      const rect = labelRect(region, data.regions, data.width, data.height);
      let size = Math.min(42, Math.max(8, region.height * 0.85)),
        lines;
      do {
        context.font = `500 ${size}px "Noto Sans Thai", "Noto Sans SC", "Noto Sans JP", "Noto Sans KR", sans-serif`;
        lines = wrapPhotoText(context, region.translation, rect.width - 4);
        if (lines.length * size * 1.12 <= rect.height - 2 || size <= 6) break;
        size -= 0.5;
      } while (size >= 6);
      context.fillStyle = region.background;
      context.fillRect(rect.x, rect.y, rect.width, rect.height);
      context.fillStyle = region.foreground;
      context.textAlign = "center";
      context.textBaseline = "middle";
      const lineHeight = size * 1.12,
        top = rect.y + (rect.height - lines.length * lineHeight) / 2 + lineHeight / 2;
      context.save();
      context.beginPath();
      context.rect(rect.x, rect.y, rect.width, rect.height);
      context.clip();
      lines.forEach((line, index) =>
        context.fillText(line, rect.x + rect.width / 2, top + index * lineHeight)
      );
      context.restore();
    }
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error();
    if (!ownsDownload()) return;
    const url = URL.createObjectURL(blob),
      link = document.createElement("a");
    link.href = url;
    link.download = `translated-${data.target_language}.png`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    if (ownsDownload()) photoStatus(t("photoDownloadError"), true);
  } finally {
    if (photoDownloadEpoch === token) button.disabled = false;
  }
});
function closePhotoCamera() {
  cameraEpoch++;
  clearTimeout(cameraTimer);
  cameraTimer = null;
  cameraStream?.getTracks().forEach((track) => track.stop());
  cameraStream = null;
  $("photo-camera-video").srcObject = null;
  $("photo-capture").disabled = true;
  if ($("photo-camera-dialog").open) $("photo-camera-dialog").close();
}
$("photo-camera").addEventListener("click", async () => {
  closePhotoCamera();
  stopRecording(true);
  stopAudio();
  const epoch = cameraEpoch;
  $("photo-camera-dialog").showModal();
  $("photo-camera-status").textContent = t("photoCameraLoading");
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error();
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });
    if (epoch !== cameraEpoch || !$("photo-camera-dialog").open) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    cameraStream = stream;
    const video = $("photo-camera-video");
    video.srcObject = stream;
    await video.play();
    if (epoch !== cameraEpoch) return;
    $("photo-capture").disabled = false;
    $("photo-camera-status").textContent = "";
    cameraTimer = setTimeout(closePhotoCamera, 180000);
  } catch {
    if (epoch === cameraEpoch) {
      cameraStream?.getTracks().forEach((track) => track.stop());
      cameraStream = null;
      $("photo-camera-status").textContent = t("photoCameraError");
    }
  }
});
$("photo-camera-close").addEventListener("click", closePhotoCamera);
$("photo-camera-dialog").addEventListener("close", () => {
  if (cameraStream) closePhotoCamera();
});
$("photo-capture").addEventListener("click", async () => {
  const video = $("photo-camera-video");
  if (!video.videoWidth || !cameraStream) return;
  const epoch = cameraEpoch;
  $("photo-capture").disabled = true;
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.94));
  if (epoch !== cameraEpoch) return;
  closePhotoCamera();
  if (blob) importPhoto(new File([blob], "camera.jpg", { type: "image/jpeg" }));
});
function schedulePhotoSettings() {
  if (mode !== "image" || !photoFile) return;
  cancelPhotoRequest();
  photoData = null;
  renderPhoto();
  photoStatus(t("photoProcessing"));
  photoTimer = setTimeout(translatePhoto, 650);
}
for (const select of [sourceEl, targetEl, $("tone")])
  select.addEventListener("change", schedulePhotoSettings);
document.addEventListener("translation:settings", schedulePhotoSettings);
document.addEventListener("photo:translate", translatePhoto);
document.addEventListener("mode:leaving", ({ detail }) => {
  if (detail.previous !== "image") return;
  pausedPhotoError = photoLastError;
  cancelPhotoRequest();
  closePhotoCamera();
});
document.addEventListener("mode:change", () => {
  if (mode === "image" && previousPhotoMode !== "image") {
    renderPhoto();
    if (photoFile && !photoData) {
      if (pausedPhotoError)
        showPhotoError(
          pausedPhotoError.message,
          Math.max(0, (pausedPhotoError.readyAt - Date.now()) / 1000),
          pausedPhotoError.isError
        );
      else showPhotoError(t("photoCanceled"), 0, false);
    }
    pausedPhotoError = null;
  }
  previousPhotoMode = mode;
});
document.addEventListener("interface:change", () => {
  renderPhoto();
  if (photoRequest) photoStatus(t("photoProcessing"));
  else if (photoData) photoStatus(t("photoDone"));
});
window.addEventListener("pagehide", () => {
  cancelPhotoRequest();
  closePhotoCamera();
  stageObservers.forEach((observer) => observer.disconnect());
  if (photoUrl) URL.revokeObjectURL(photoUrl);
});
