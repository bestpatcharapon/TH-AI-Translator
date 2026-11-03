/* Read one language at a time on phones, using the Document reader's tab pattern. */
const multilingualMobile = window.matchMedia("(max-width: 700px)");
const multilingualRoot = document.querySelector(".translator");
const multilingualTabs = $("multilingual-reader-tabs");
function sizeMultilingualEditors() {
  if (!multilingualRoot.classList.contains("multilingual-reader")) return;
  for (const editor of [inputEl, outputEl]) {
    if (!editor.getClientRects().length) continue;
    const position = editor.scrollTop;
    editor.style.setProperty("--reader-editor-height", "auto");
    editor.style.setProperty(
      "--reader-editor-height",
      `${Math.min(320, Math.max(96, editor.scrollHeight))}px`
    );
    editor.scrollTop = position;
  }
}
function syncMultilingualStatus() {
  const status = $("multilingual-reader-status");
  status.textContent = statusEl.textContent;
  status.classList.toggle("error", statusEl.classList.contains("error"));
  status.hidden =
    !multilingualRoot.classList.contains("multilingual-reader") ||
    activeFeature().readerPane === "primary" ||
    !status.textContent;
}
function multilingualEntries() {
  const workspace = activeFeature();
  return [
    { key: "source", label: t("source"), panel: $("document-source-panel") },
    {
      key: "primary",
      label: languageName(targetEl.value),
      language: targetEl.value,
      panel: $("document-translation-panel"),
      disabled: !outputEl.value.trim(),
    },
    ...workspace.preferences.targets
      .filter((target) => target !== targetEl.value)
      .map((target) => {
        const result = workspace.additional.find((item) => item.target === target);
        return {
          key: target,
          label: languageName(target),
          language: target,
          panel: $(`translation-result-${target}`),
          disabled: !result,
          pending: !!result?.pending,
          error: !!result?.error,
        };
      }),
  ];
}
function selectMultilingualPane(key, focus = false) {
  const entry = multilingualEntries().find((item) => item.key === key);
  if (!entry || entry.disabled) return;
  const workspace = activeFeature();
  workspace.readerPane = key;
  if (key !== "source") workspace.readerTarget = key;
  syncMultilingualReader();
  if (focus) $(key === "source" ? "reader-tab-source" : "reader-tab-primary").focus();
}
function syncMultilingualReader() {
  const workspace = activeFeature();
  const enabled =
    mode === "text" &&
    multilingualMobile.matches &&
    workspace.preferences.multiple &&
    workspace.preferences.targets.some((target) => target !== targetEl.value);
  multilingualRoot.classList.toggle("multilingual-reader", enabled);
  $("multilingual-reader-navigation").hidden = !enabled;
  multilingualTabs.hidden = !enabled;
  if (!enabled) {
    closeReaderLanguageMenu();
    if (mode !== "document") {
      for (const [id, heading] of [
        ["document-source-panel", "source-heading"],
        ["document-translation-panel", "translation-heading"],
      ]) {
        $(id).removeAttribute("role");
        $(id).setAttribute("aria-labelledby", heading);
      }
    }
    for (const card of $("additional-results").children) {
      card.removeAttribute("role");
      card.removeAttribute("aria-labelledby");
    }
    syncMultilingualStatus();
    return;
  }
  const entries = multilingualEntries();
  const targets = entries.slice(1);
  if (!entries.some((entry) => entry.key === workspace.readerPane && !entry.disabled))
    workspace.readerPane = "source";
  if (!targets.some((entry) => entry.key === workspace.readerTarget && !entry.disabled))
    workspace.readerTarget = targets.find((entry) => !entry.disabled)?.key || "primary";
  const pane = workspace.readerPane;
  const source = pane === "source";
  const result = targets.find((entry) => entry.key === workspace.readerTarget);
  multilingualRoot.dataset.readerPane = ["source", "primary"].includes(pane) ? pane : "extra";
  multilingualTabs.setAttribute("aria-label", t("translation"));
  for (const [id, selected, label, panel] of [
    ["reader-tab-source", source, t("source"), $("document-source-panel")],
    ["reader-tab-primary", !source, t("translation"), result?.panel],
  ]) {
    const tab = $(id);
    tab.textContent = label;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    tab.disabled = id === "reader-tab-primary" && !targets.some((entry) => !entry.disabled);
    if (panel) tab.setAttribute("aria-controls", panel.id);
    else tab.removeAttribute("aria-controls");
  }
  if (source) closeReaderLanguageMenu();
  $("reader-language-field").hidden = source;
  $("reader-language-label").textContent = locale === "th" ? "ภาษาคำแปล" : "Translation language";
  const select = $("reader-language");
  const signature = targets.map((entry) => entry.key).join("|");
  if (select.dataset.entries !== signature) {
    select.replaceChildren(...targets.map((entry) => new Option(entry.label, entry.key)));
    select.dataset.entries = signature;
  }
  targets.forEach((entry, index) => {
    select.options[index].disabled = !!entry.disabled;
    select.options[index].textContent =
      entry.label + (entry.pending ? ` · ${t("loading")}` : entry.error ? ` · ${t("retry")}` : "");
  });
  select.value = workspace.readerTarget;
  renderReaderLanguagePicker(targets);
  for (const entry of entries) {
    if (!entry.panel) continue;
    entry.panel.setAttribute("role", "tabpanel");
    entry.panel.setAttribute(
      "aria-labelledby",
      entry.key === "source" ? "reader-tab-source" : "reader-tab-primary"
    );
    entry.panel.dataset.readerSelected = String(pane === entry.key);
    if (entry.key !== "source" && entry.key !== "primary") {
      entry.panel.setAttribute("aria-busy", String(!!entry.pending));
      entry.panel.tabIndex = 0;
      entry.panel.scrollTop = workspace.readerScroll?.[entry.key] || 0;
    }
  }
  syncMultilingualStatus();
  sizeMultilingualEditors();
}
function closeReaderLanguageMenu(restoreFocus = false) {
  const menu = $("reader-language-menu");
  if (menu.matches(":popover-open")) menu.hidePopover();
  $("reader-language-trigger").setAttribute("aria-expanded", "false");
  if (restoreFocus) $("reader-language-trigger").focus({ preventScroll: true });
}
function positionReaderLanguageMenu() {
  const menu = $("reader-language-menu");
  if (!menu.matches(":popover-open")) return;
  const anchor = $("reader-language-trigger").getBoundingClientRect();
  const viewport = window.visualViewport;
  const left = viewport?.offsetLeft || 0,
    top = viewport?.offsetTop || 0;
  const width = viewport?.width || innerWidth,
    height = viewport?.height || innerHeight;
  menu.style.width = `${Math.min(300, width - 24)}px`;
  menu.style.maxHeight = `${Math.max(80, height - 24)}px`;
  const box = menu.getBoundingClientRect();
  const x = document.documentElement.dir === "rtl" ? anchor.left : anchor.right - box.width;
  const y =
    anchor.bottom + 8 + box.height <= top + height - 12
      ? anchor.bottom + 8
      : anchor.top - box.height - 8;
  menu.style.left = `${Math.max(left + 12, Math.min(x, left + width - box.width - 12))}px`;
  menu.style.top = `${Math.max(top + 12, Math.min(y, top + height - box.height - 12))}px`;
}
function renderReaderLanguagePicker(entries) {
  const selected = entries.find((entry) => entry.key === activeFeature().readerTarget);
  const trigger = $("reader-language-trigger");
  const name = document.createElement("span");
  name.textContent = selected?.label || "";
  trigger.replaceChildren(
    ...(selected ? [additionalFlag(selected.language)] : []),
    name,
    preferenceIcon("chevron")
  );
  trigger.setAttribute(
    "aria-label",
    `${$("reader-language-label").textContent} · ${name.textContent}`
  );
  const menu = $("reader-language-menu");
  const focusKey = menu.contains(document.activeElement)
    ? document.activeElement.dataset.value
    : null;
  for (const child of [...menu.children])
    if (!entries.some((entry) => entry.key === child.dataset.value)) child.remove();
  for (const entry of entries) {
    let option = [...menu.children].find((item) => item.dataset.value === entry.key);
    if (!option) {
      option = document.createElement("button");
      option.type = "button";
      option.dataset.value = entry.key;
      option.setAttribute("role", "option");
      option.addEventListener("click", () => {
        selectMultilingualPane(entry.key);
        closeReaderLanguageMenu(true);
      });
      menu.append(option);
    }
    option.disabled = !!entry.disabled;
    option.setAttribute("aria-selected", String(entry.key === selected?.key));
    option.tabIndex = (focusKey || selected?.key) === entry.key ? 0 : -1;
    const copy = document.createElement("span");
    copy.className = "reader-language-copy";
    const title = document.createElement("bdi");
    title.textContent = entry.label;
    const subtitle = document.createElement("small");
    subtitle.textContent = entry.pending
      ? t("loading")
      : entry.error
        ? t("retry")
        : LANGUAGES[entry.language][1];
    copy.append(title, subtitle);
    option.replaceChildren(
      additionalFlag(entry.language),
      copy,
      preferenceIcon("check", "reader-language-check")
    );
  }
  positionReaderLanguageMenu();
}
function openReaderLanguageMenu(last = false) {
  const menu = $("reader-language-menu");
  menu.showPopover();
  $("reader-language-trigger").setAttribute("aria-expanded", "true");
  positionReaderLanguageMenu();
  const options = [...menu.children].filter((item) => !item.disabled);
  const selected = options.find((item) => item.getAttribute("aria-selected") === "true");
  (last ? options.at(-1) : selected || options[0])?.focus({ preventScroll: true });
}
$("reader-language-trigger").addEventListener("click", (event) => {
  event.preventDefault();
  if ($("reader-language-menu").matches(":popover-open")) closeReaderLanguageMenu(true);
  else openReaderLanguageMenu();
});
$("reader-language-trigger").addEventListener("keydown", (event) => {
  if (!["ArrowDown", "ArrowUp"].includes(event.key)) return;
  event.preventDefault();
  openReaderLanguageMenu(event.key === "ArrowUp");
});
$("reader-language-menu").addEventListener("toggle", (event) => {
  $("reader-language-trigger").setAttribute("aria-expanded", String(event.newState === "open"));
});
$("reader-language-menu").addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    closeReaderLanguageMenu(true);
    return;
  }
  if (event.key === "Tab") {
    closeReaderLanguageMenu(true);
    return;
  }
  const options = [...$("reader-language-menu").children].filter((item) => !item.disabled);
  const index = options.indexOf(document.activeElement);
  let next;
  if (event.key === "Home") next = options[0];
  else if (event.key === "End") next = options.at(-1);
  else if (["ArrowDown", "ArrowUp"].includes(event.key))
    next =
      options[(index + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length];
  else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && event.key !== " ")
    next = [...options.slice(index + 1), ...options.slice(0, index + 1)].find((item) =>
      item
        .querySelector("bdi")
        .textContent.toLocaleLowerCase()
        .startsWith(event.key.toLocaleLowerCase())
    );
  if (!next) return;
  event.preventDefault();
  options.forEach((item) => {
    item.tabIndex = item === next ? 0 : -1;
  });
  next.focus({ preventScroll: true });
  next.scrollIntoView({ block: "nearest" });
});
window.addEventListener("resize", positionReaderLanguageMenu);
window.visualViewport?.addEventListener("resize", positionReaderLanguageMenu);
window.visualViewport?.addEventListener("scroll", positionReaderLanguageMenu);
document.addEventListener("mode:leaving", () => closeReaderLanguageMenu());
$("reader-tab-source").addEventListener("click", () => selectMultilingualPane("source"));
$("reader-tab-primary").addEventListener("click", () =>
  selectMultilingualPane(activeFeature().readerTarget || "primary")
);
$("reader-language").addEventListener("change", (event) =>
  selectMultilingualPane(event.target.value)
);
for (const tab of multilingualTabs.children) {
  tab.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const source = event.key === "Home" || (event.key !== "End" && tab.id !== "reader-tab-source");
    selectMultilingualPane(source ? "source" : activeFeature().readerTarget || "primary", true);
  });
}
$("additional-results").addEventListener(
  "scroll",
  (event) => {
    const card = event.target;
    if (mode === "text" && card.classList?.contains("additional-result")) {
      activeFeature().readerScroll ??= {};
      activeFeature().readerScroll[card.dataset.target] = card.scrollTop;
    }
  },
  true
);
document.addEventListener("translation:invalidated", () => {
  activeFeature().readerPane = "source";
  activeFeature().readerTarget = "primary";
  activeFeature().readerScroll = {};
  syncMultilingualReader();
});
document.addEventListener("translation:complete", () => {
  activeFeature().readerPane = "primary";
  activeFeature().readerTarget = "primary";
  syncMultilingualReader();
  if (multilingualRoot.classList.contains("multilingual-reader"))
    $("reader-tab-primary")?.scrollIntoView({ block: "nearest", inline: "nearest" });
});
for (const name of ["additional:rendered", "mode:restored", "interface:change", "languages:change"])
  document.addEventListener(name, syncMultilingualReader);
multilingualMobile.addEventListener("change", syncMultilingualReader);
window.addEventListener("resize", sizeMultilingualEditors);
inputEl.addEventListener("input", sizeMultilingualEditors);
new MutationObserver(syncMultilingualStatus).observe(statusEl, {
  childList: true,
  attributes: true,
  attributeFilter: ["class"],
});
syncMultilingualReader();
