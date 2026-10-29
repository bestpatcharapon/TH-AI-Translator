/* Documents keep their own reading position and use one generous pane on phones. */
const documentReader = {
  file: null,
  pane: "source",
  autoOpenTranslation: true,
  scroll: { source: 0, translation: 0 },
};
const documentMobile = window.matchMedia("(max-width: 700px)");
const documentTabs = [$("document-tab-source"), $("document-tab-translation")];
const documentEditors = { source: inputEl, translation: outputEl };
const documentRoot = document.querySelector(".translator");
function saveDocumentPosition() {
  if (mode !== "document") return;
  for (const [pane, editor] of Object.entries(documentEditors)) {
    if (!documentMobile.matches || pane === documentReader.pane)
      documentReader.scroll[pane] = editor.scrollTop;
  }
}
function syncDocumentReader() {
  const active = mode === "document",
    mobile = active && documentMobile.matches,
    file = featureWorkspaces.get("document").documentFile;
  if (file !== documentReader.file) {
    documentReader.file = file;
    documentReader.pane = "source";
    documentReader.autoOpenTranslation = true;
    documentReader.scroll = { source: 0, translation: 0 };
  }
  if (active && !outputEl.value.trim()) documentReader.pane = "source";
  documentRoot.classList.toggle("document-has-file", active && !!file);
  documentRoot.dataset.documentView = documentReader.pane;
  $("document-reader-tabs").hidden = !mobile;
  $("document-reader-tabs").setAttribute("aria-label", t("document"));
  $("replace-document").disabled = $("choose-file").disabled;
  $("replace-document").setAttribute(
    "aria-label",
    `${t("chooseDocument")} · ${$("file-name").textContent}`
  );
  $("replace-document").title = t("chooseDocument");
  documentTabs.forEach((tab, index) => {
    const pane = index ? "translation" : "source",
      selected = documentReader.pane === pane;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    tab.disabled = active && pane === "translation" && !outputEl.value.trim();
    const panel = $(tab.getAttribute("aria-controls"));
    if (mobile) {
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", tab.id);
    } else {
      panel.removeAttribute("role");
      panel.setAttribute("aria-labelledby", index ? "translation-heading" : "source-heading");
    }
  });
  const status = $("document-reader-status");
  status.textContent = active ? statusEl.textContent : "";
  status.classList.toggle("error", statusEl.classList.contains("error"));
  status.hidden = !mobile || documentReader.pane === "translation" || !status.textContent;
}
function selectDocumentPane(pane, manual = false, saveCurrent = true) {
  if (mode !== "document" || (pane === "translation" && !outputEl.value.trim())) return;
  if (saveCurrent) saveDocumentPosition();
  const offset = documentReader.scroll[pane];
  documentReader.pane = pane;
  if (manual) documentReader.autoOpenTranslation = false;
  syncDocumentReader();
  requestAnimationFrame(() => {
    if (mode === "document" && documentReader.pane === pane)
      documentEditors[pane].scrollTop = offset;
  });
}
documentTabs.forEach((tab, index) => {
  tab.addEventListener("click", () => selectDocumentPane(index ? "translation" : "source", true));
  tab.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const available = documentTabs.filter((item) => !item.disabled);
    const next =
      event.key === "Home"
        ? available[0]
        : event.key === "End"
          ? available.at(-1)
          : available[(available.indexOf(tab) + 1) % available.length];
    next.click();
    next.focus();
  });
});
for (const [pane, editor] of Object.entries(documentEditors)) {
  editor.addEventListener("scroll", () => {
    if (mode === "document" && (!documentMobile.matches || pane === documentReader.pane))
      documentReader.scroll[pane] = editor.scrollTop;
  });
}
$("replace-document").addEventListener("click", () => $("file-input").click());
document.addEventListener("mode:leaving", saveDocumentPosition);
document.addEventListener("mode:restored", () => {
  syncDocumentReader();
  if (mode === "document") selectDocumentPane(documentReader.pane, false, false);
});
document.addEventListener("translation:invalidated", () => {
  if (mode !== "document") return;
  syncDocumentReader();
});
inputEl.addEventListener("input", () => {
  if (mode === "document") documentReader.autoOpenTranslation = false;
});
document.addEventListener("translation:complete", (event) => {
  if (event.detail.feature !== "document" || mode !== "document") return;
  syncDocumentReader();
  if (documentReader.autoOpenTranslation) selectDocumentPane("translation");
  documentReader.autoOpenTranslation = false;
});
document.addEventListener("interface:change", syncDocumentReader);
documentMobile.addEventListener("change", () => {
  syncDocumentReader();
  if (mode === "document") selectDocumentPane(documentReader.pane, false, false);
});
new MutationObserver(syncDocumentReader).observe($("file-preview"), {
  attributes: true,
  attributeFilter: ["hidden"],
});
new MutationObserver(syncDocumentReader).observe($("file-name"), { childList: true });
new MutationObserver(syncDocumentReader).observe($("choose-file"), {
  attributes: true,
  attributeFilter: ["disabled"],
});
new MutationObserver(syncDocumentReader).observe(statusEl, {
  childList: true,
  attributes: true,
  attributeFilter: ["class"],
});
syncDocumentReader();
