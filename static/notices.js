/* Short notices expire together; progress and actual translation/review content remain. */
(() => {
  const duration = 3000;
  const progressKeys = [
    "waiting",
    "loading",
    "working",
    "extracting",
    "transcribing",
    "speechLoading",
    "speechPlaying",
    "recording",
    "photoProcessing",
    "photoCameraLoading",
    "sourceInfoLoading",
    "thaiChecking",
    "reviewWorking",
    "compareWorking",
    "auditWorking",
    "interfaceLanguageLoading",
  ];
  const noticeIds = [
    "status",
    "live-status",
    "voice-status",
    "file-status",
    "source-info-status",
    "suggestion-status",
    "reply-edit-status",
    "menu-status",
    "glossary-status",
    "thai-lexicon-status",
    "photo-status",
    "photo-label-status",
    "photo-camera-status",
    "interface-language-status",
    "studio-status",
    "explanation-text",
    "check-text",
  ];
  const resultIds = new Set(["explanation-text", "check-text"]);
  const timers = new Map();
  const observers = new Map();
  const isProgress = (message) =>
    Object.values(COPY).some((copy) =>
      progressKeys.some(
        (key) =>
          typeof copy[key] === "string" &&
          (message === copy[key] || message.startsWith(copy[key] + " · "))
      )
    );

  function forgetSavedNotice(workspace, id, message) {
    const field =
      id === "status" || id === "live-status"
        ? "status"
        : id === "file-status"
          ? "fileStatus"
          : null;
    if (field && workspace.view[field] === message) {
      workspace.view[field] = "";
      workspace.view[field === "status" ? "statusError" : "fileError"] = false;
    }
    const saved = workspace.assistant?.text?.[id];
    if (saved?.text === message) Object.assign(saved, { text: "", error: false });
    if (id === "studio-status" && workspace.studio.status === message) {
      workspace.studio.status = "";
      workspace.studio.error = false;
    }
  }

  function clearNotice(node, entry) {
    clearTimeout(entry.timer);
    timers.delete(node);
    forgetSavedNotice(entry.workspace, node.id, entry.message);
    if (node.textContent === entry.message) {
      node.textContent = "";
      node.classList.remove("error");
    }
  }

  function watchNotice(node) {
    const previous = timers.get(node);
    if (previous) clearTimeout(previous.timer);
    timers.delete(node);
    const message = node.textContent.trim();
    if (
      !message ||
      isProgress(message) ||
      (resultIds.has(node.id) && !node.classList.contains("error"))
    )
      return;
    const entry = { message: node.textContent, workspace: activeFeature(), timer: null };
    entry.timer = setTimeout(() => {
      if (timers.get(node) === entry) clearNotice(node, entry);
    }, duration);
    timers.set(node, entry);
  }

  for (const id of noticeIds) {
    const node = $(id);
    if (!node) continue;
    const observer = new MutationObserver(() => watchNotice(node));
    observer.observe(node, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    observers.set(node, observer);
    watchNotice(node);
  }
  // Do not restore expired clipboard/error notices when returning to a feature.
  document.addEventListener("mode:leaving", () => {
    // A status may have changed in the same task, before observer callbacks run.
    for (const [node, observer] of observers) {
      if (observer.takeRecords().length) watchNotice(node);
    }
    for (const [node, entry] of timers) clearNotice(node, entry);
  });
})();
