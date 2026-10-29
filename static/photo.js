/* Photo translation keeps the original pixels and draws positioned translated labels. */
Object.assign(COPY.en, {
  photoEyebrow: "AI PHOTO TRANSLATION",
  photoTitle: "Translate text in photos",
  photoIntro: "Menus, signs or documents. Read the translation right on your photo.",
  photoChoose: "Choose image",
  photoCamera: "Use camera",
  photoHelp: "Choose a photo and see its translation on the image.",
  photoFormats: "PNG, JPEG, WebP, HEIC/HEIF · up to 10 MB",
  photoOriginal: "Original photo",
  photoTranslated: "Translated photo",
  photoFullscreen: "Full screen",
  photoChange: "Change photo",
  photoRemove: "Remove photo",
  photoDownload: "Download translated image",
  photoProcessing: "Translating photo…",
  photoDone: "Translation is on the photo. Tap a label or open full screen to read it.",
  photoTarget: "Translate into {language} · Change",
  photoDoneCount: "Translated {count} text areas into {language}. Tap a label to read it.",
  photoReview: "{count} text areas need checking. Open the readings below or use a clearer photo.",
  photoReadings: "Read all translations ({count})",
  photoReadingUnclear: "Text unclear — check the original photo",
  photoNumbersKept: "Numeric-only areas are kept from the original photo.",
  photoUnchanged: "No text changed. Check the source language or try a clearer photo.",
  photoCapture: "Take photo",
  photoCameraLoading: "Opening camera…",
  photoCameraError:
    "Could not open the camera. Allow camera access and use HTTPS or localhost, or choose an image instead.",
  photoDownloadError: "Could not download the image. Please try again.",
});
Object.assign(COPY.th, {
  photoEyebrow: "แปลข้อความบนภาพด้วย AI",
  photoTitle: "แปลข้อความทับบนรูปภาพ",
  photoIntro: "เมนู ป้าย หรือเอกสาร อ่านคำแปลบนรูปเดิมได้เลย",
  photoChoose: "เลือกรูปภาพ",
  photoCamera: "ใช้กล้อง",
  photoHelp: "เลือกรูป แล้วดูคำแปลที่วางบนข้อความในภาพ",
  photoFormats: "PNG, JPEG, WebP, HEIC/HEIF · สูงสุด 10 MB",
  photoOriginal: "รูปต้นฉบับ",
  photoTranslated: "รูปที่แปลแล้ว",
  photoFullscreen: "เต็มหน้าจอ",
  photoChange: "เปลี่ยนรูป",
  photoRemove: "นำรูปออก",
  photoDownload: "ดาวน์โหลดรูปที่แปลแล้ว",
  photoProcessing: "กำลังแปลรูปภาพ…",
  photoDone: "แปลบนรูปแล้ว กดข้อความหรือเปิดเต็มจอเพื่ออ่านให้ชัดขึ้น",
  photoTarget: "แปลเป็น{language} · เปลี่ยนภาษา",
  photoDoneCount: "แปลเป็น{language}แล้ว {count} ส่วน แตะข้อความเพื่ออ่านให้ชัดขึ้น",
  photoReview: "มี {count} ส่วนที่ยังอ่านไม่ชัด เปิดรายการด้านล่างเพื่อตรวจ หรือใช้รูปที่ชัดขึ้น",
  photoReadings: "อ่านคำแปลทั้งหมด ({count})",
  photoReadingUnclear: "ยังอ่านไม่ชัด กรุณาเทียบกับรูปต้นฉบับ",
  photoNumbersKept: "ส่วนที่เป็นตัวเลขล้วนคงไว้จากภาพต้นฉบับ",
  photoUnchanged:
    "ยังไม่มีข้อความที่เปลี่ยนเป็นคำแปล ลองเลือกภาษาต้นทางให้ตรงกับข้อความหรือใช้รูปที่ชัดขึ้น",
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
let photoReadingsData = null;
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
  syncPhotoViewerStatus();
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
  syncPhotoViewerStatus();
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
function syncPhotoViewerStatus() {
  const status = $("photo-viewer-status");
  let message = "";
  if (photoLastError) {
    message = `${t("photoNotCompleted")} · ${t("photoOriginal")}\n${photoLastError.message}`;
  } else if (photoFile && !photoData) {
    message = `${t("photoOriginal")} · ${t($("photo-loading").hidden ? "photoNotCompleted" : "photoProcessing")}`;
  } else if (photoData?.review_required) {
    message = t("photoReview").replace("{count}", String(photoData.review_required));
  }
  status.textContent = message;
  status.hidden = !message;
  $("photo-viewer-original").disabled = !photoData;
}
function photoCompletionStatus() {
  if (photoData?.review_required) {
    photoStatus(t("photoReview").replace("{count}", String(photoData.review_required)), true);
    return;
  }
  const unchanged = photoData?.translated_regions === 0;
  photoStatus(unchanged ? t("photoUnchanged") : "", unchanged);
}
function openPhotoReading(region, data) {
  if (mode !== "image" || photoData !== data) return;
  photoActiveLabel = region;
  $("photo-label-text").textContent = region.reading_review
    ? t("photoReadingUnclear")
    : region.translation;
  $("photo-label-text").lang = data.target_language;
  $("photo-label-text").dir = "auto";
  $("photo-label-status").textContent = "";
  $("photo-label-dialog").showModal();
}
function renderPhotoReadings() {
  const data = photoData,
    list = $("photo-readings-list");
  const readings = data?.regions?.filter((region) => !region.preserve_original) || [];
  $("photo-readings").hidden = !readings.length;
  list.replaceChildren();
  if (!data) {
    photoReadingsData = null;
    $("photo-readings").open = false;
    return;
  }
  $("photo-readings-title").textContent = t("photoReadings").replace(
    "{count}",
    String(readings.length)
  );
  if (data !== photoReadingsData) {
    $("photo-readings").open = true;
    photoReadingsData = data;
  }
  for (const [index, region] of readings.entries()) {
    const row = document.createElement("button"),
      number = document.createElement("span"),
      copy = document.createElement("span"),
      source = document.createElement("small"),
      output = document.createElement("strong");
    row.type = "button";
    row.disabled = !!region.reading_review;
    row.className = "photo-reading";
    number.className = "photo-reading-number";
    number.textContent = String(index + 1).padStart(2, "0");
    number.setAttribute("aria-hidden", "true");
    copy.className = "photo-reading-copy";
    source.textContent = region.text;
    source.lang = data.source_language;
    source.dir = "auto";
    output.textContent = region.reading_review ? t("photoReadingUnclear") : region.translation;
    output.lang = data.target_language;
    output.dir = "auto";
    row.classList.toggle("needs-review", !!region.reading_review);
    copy.append(output, source);
    row.append(number, copy);
    row.addEventListener("click", () => openPhotoReading(region, data));
    list.append(row);
  }
}
function cancelPhotoRequest() {
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
  $("photo-original").hidden = !photoData;
  document.querySelector(".photo-actions").classList.toggle("has-translation", !!photoData);
  $("photo-fullscreen").disabled = !photoFile;
  syncPhotoViewerStatus();
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
  let low = 12,
    high = Math.floor(Math.min(42, Math.max(8, originalHeight * 0.85)) * 2),
    best = 12;
  // Find the largest fitting half-pixel size without dozens of forced layouts per label.
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    button.style.fontSize = `${middle / 2}px`;
    if (
      content.scrollHeight <= button.clientHeight - 2 &&
      content.scrollWidth <= button.clientWidth - 4
    ) {
      best = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  const size = best / 2;
  button.style.fontSize = `${size}px`;
  button.dataset.fontSize = String(size);
}
function photoProtectedBoxes(data) {
  const boxes = [
    ...(data.protected_boxes || []),
    ...data.regions.filter((region) => region.preserve_original),
  ];
  return boxes
    .filter((box) => [box.x, box.y, box.width, box.height].every(Number.isFinite))
    .map((box) => {
      const x = Math.max(0, Math.floor(box.x)),
        y = Math.max(0, Math.floor(box.y));
      return {
        x,
        y,
        width: Math.min(data.width - x, Math.ceil(box.width)),
        height: Math.min(data.height - y, Math.ceil(box.height)),
      };
    })
    .filter((box) => box.width > 0 && box.height > 0);
}
function drawProtectedPhotoAreas(context, image, data) {
  for (const { x, y, width, height } of photoProtectedBoxes(data))
    context.drawImage(image, x, y, width, height, x, y, width, height);
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
  if (id === "photo-main-stage") {
    stage.style.removeProperty("--photo-ratio");
    const fitPreview = () => {
      if (stage.contains(image) && image.naturalHeight)
        stage.style.setProperty("--photo-ratio", image.naturalWidth / image.naturalHeight);
    };
    image.addEventListener("load", fitPreview, { once: true });
  }
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
      region.preserve_original ||
      region.reading_review ||
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
    label.dir = "auto";
    label.setAttribute("aria-label", region.translation);
    label.title = region.translation;
    const content = document.createElement("span");
    content.textContent = region.translation;
    label.append(content);
    label.addEventListener("click", () => openPhotoReading(region, data));
    overlay.append(label);
    labels.push([label, region]);
  }
  stage.append(overlay);
  if (photoProtectedBoxes(data).length) {
    const protection = document.createElement("canvas");
    protection.className = "photo-protected";
    protection.width = data.width;
    protection.height = data.height;
    protection.setAttribute("aria-hidden", "true");
    overlay.append(protection);
    const restore = () => {
      if (photoData === data && stage.contains(protection))
        drawProtectedPhotoAreas(protection.getContext("2d"), image, data);
    };
    if (image.complete && image.naturalWidth) restore();
    else image.addEventListener("load", restore, { once: true });
  }
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
  $("photo-remove").title = t("photoRemove");
  $("photo-number-note").hidden = !photoData || !photoProtectedBoxes(photoData).length;
  $("photo-number-note").textContent = t("photoNumbersKept");
  $("photo-target-language").textContent = t("photoTarget").replace(
    "{language}",
    languageName(targetEl.value)
  );
  renderPhotoReadings();
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
  $("photo-original").hidden = !photoData;
  document.querySelector(".photo-actions").classList.toggle("has-translation", !!photoData);
  syncPhotoViewerStatus();
}
async function importPhoto(file) {
  if (file.size > 10 * 1024 * 1024) {
    photoStatus(t("fileTooLarge"), true);
    return;
  }
  if (
    !/^image\/(png|jpeg|webp|heic|heif)(-sequence)?$/i.test(file.type) &&
    !/\.(png|jpe?g|webp|heic|heif)$/i.test(file.name)
  ) {
    photoStatus(t("fileUnsupported"), true);
    return;
  }
  if (mode !== "image") return;
  cancelPhotoRequest();
  stopAudio();
  stopRecording(true);
  if (photoUrl) URL.revokeObjectURL(photoUrl);
  photoFile = file;
  const needsPreview = /^image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
  photoUrl = needsPreview ? null : URL.createObjectURL(file);
  photoData = null;
  showingOriginal = false;
  completedPhotoSettings = "";
  $("photo-retry").hidden = true;
  renderPhoto();
  if (needsPreview) {
    const epoch = photoEpoch,
      controller = new AbortController();
    photoRequest = controller;
    setPhotoBusy(true);
    photoStatus(t("photoProcessing"));
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/photo-preview", {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
      if (!response.ok) await responseJson(response);
      const blob = await response.blob();
      if (epoch !== photoEpoch || mode !== "image") return;
      photoUrl = URL.createObjectURL(blob);
      renderPhoto();
    } catch (error) {
      if (epoch === photoEpoch && mode === "image") {
        setPhotoBusy(false);
        showPhotoError(error.name === "AbortError" ? t("photoTimeout") : error.message);
      }
      return;
    } finally {
      clearTimeout(timeout);
      if (epoch === photoEpoch) photoRequest = null;
    }
  }
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
  form.append("defer_additional", String(options.defer_additional));
  form.append("extra_context", options.extra_context);
  form.append("additional_targets", JSON.stringify(options.additional_targets));
  form.append("glossary", JSON.stringify(options.glossary));
  document.dispatchEvent(new CustomEvent("additional:clear"));
  try {
    const data = await responseJson(
      await fetchWithRetry("/api/photo-translate", {
        method: "POST",
        body: form,
        signal: controller.signal,
      })
    );
    if (epoch !== photoEpoch || mode !== "image") return;
    photoData = data;
    completedPhotoSettings = signature;
    renderPhoto();
    photoCompletionStatus();
    document.dispatchEvent(new CustomEvent("photo:result"));
    if (!data.review_required)
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
$("photo-target-language").addEventListener("click", () => $("target-picker").click());
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
  syncPhotoViewerStatus();
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
  $("photo-target-language").textContent = t("photoTarget").replace(
    "{language}",
    languageName(targetEl.value)
  );
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
  else if (photoData) photoCompletionStatus();
});
window.addEventListener("pagehide", () => {
  cancelPhotoRequest();
  closePhotoCamera();
  stageObservers.forEach((observer) => observer.disconnect());
  if (photoUrl) URL.revokeObjectURL(photoUrl);
});
