/* Installable app shell, honest offline notice and a one-time quick start. */
(() => {
  // Kept outside COPY so the 113 prepared menu bundles still match en.json exactly;
  // languages other than English/Thai fall back to English for these four labels.
  const labels = {
    en: {
      offlineNotice:
        "You're offline. The app is open, but translating needs an internet connection.",
      onboardingTitle: "Quick start",
      onboardingText:
        "Type or paste to translate automatically. Use the bottom bar for Image, Document and Live Chat. Open ⋮ for style, context, history and app language. Use the buttons below the translation to explain wording or review important text.",
      onboardingDismiss: "Got it",
    },
    th: {
      offlineNotice: "ตอนนี้ออฟไลน์อยู่ เปิดแอปได้ แต่การแปลต้องใช้อินเทอร์เน็ต",
      onboardingTitle: "เริ่มใช้งานแบบเร็ว",
      onboardingText:
        "พิมพ์หรือวางข้อความแล้วระบบจะแปลให้อัตโนมัติ แถบด้านล่างใช้สลับไปแปลรูปภาพ เอกสาร หรือแชทสด เมนู ⋮ ใช้ตั้งค่าสไตล์ บริบท ประวัติ และภาษาของแอป ใช้ปุ่มใต้คำแปลเพื่อดูเหตุผลการเลือกคำหรือตรวจทานข้อความสำคัญ",
      onboardingDismiss: "เข้าใจแล้ว",
    },
  };
  const label = (key) => labels[locale]?.[key] || labels.en[key];

  const banner = document.getElementById("offline-banner");
  const syncOnline = () => {
    banner.hidden = navigator.onLine;
    banner.textContent = label("offlineNotice");
  };
  window.addEventListener("online", syncOnline);
  window.addEventListener("offline", syncOnline);

  const tipsKey = "translator-onboarding-v1";
  const tips = document.getElementById("onboarding");
  let seen = false;
  try {
    seen = localStorage.getItem(tipsKey) === "1";
  } catch {
    /* Show once per session when storage is unavailable. */
  }
  const renderTips = () => {
    document.getElementById("onboarding-title").textContent = label("onboardingTitle");
    document.getElementById("onboarding-text").textContent = label("onboardingText");
    document.getElementById("onboarding-dismiss").textContent = label("onboardingDismiss");
  };
  tips.hidden = seen;
  const dismissTips = () => {
    if (tips.hidden) return;
    tips.hidden = true;
    try {
      localStorage.setItem(tipsKey, "1");
    } catch {
      /* Hidden for this session. */
    }
  };
  document.getElementById("onboarding-dismiss").addEventListener("click", () => {
    dismissTips();
    document.getElementById("input").focus();
  });
  // Starting to use the app counts as "got it", so the card never costs layout space for long.
  document.getElementById("input").addEventListener("input", dismissTips);
  document
    .querySelectorAll(".mode-nav .mode")
    .forEach((button) => button.addEventListener("click", dismissTips));
  document.addEventListener("interface:change", () => {
    renderTips();
    syncOnline();
  });
  renderTips();
  syncOnline();

  // Automated browsers skip registration so tests keep their own network mocks.
  if ("serviceWorker" in navigator && window.isSecureContext && !navigator.webdriver)
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* The app still works online without the offline shell. */
      });
    });
})();
