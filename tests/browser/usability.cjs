/* Quick start, direct review tools, offline notice, PWA assets and Thai type scale. */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const base = process.env.TRANSLATOR_TEST_URL || "http://127.0.0.1:5000";
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/translate", (route) =>
      route.fulfill({
        json: {
          translation: "Hello",
          source_language: "th",
          audit: { status: "clear", issues: [] },
          quality_review: { status: "not_requested" },
          additional_translations: [],
        },
      })
    );
    await page.route("**/api/assist", (route) =>
      route.fulfill({ json: { explanation: "why", alternatives: [], romanization: "" } })
    );
    await page.goto(base);

    // First visit shows the quick start once; dismissal persists.
    assert(await page.locator("#onboarding").isVisible());
    await page.locator("#onboarding-dismiss").click();
    assert(await page.locator("#onboarding").isHidden());
    assert.equal(await page.evaluate(() => document.activeElement.id), "input");
    await page.reload();
    assert(await page.locator("#onboarding").isHidden());

    // Review actions are available directly, including after opening and closing a panel.
    await page.locator("#input").fill("สวัสดี");
    await page.waitForFunction(() => document.querySelector("#output").value === "Hello");
    assert.equal(await page.locator("#review-tools-toggle").count(), 0);
    assert(await page.locator("#explain").isVisible());
    assert(await page.locator("#check-translation").isVisible());
    assert(await page.locator("#open-studio").isVisible());
    await page.locator("#explain").click();
    await page.locator("#explanation-panel").waitFor();
    assert(await page.locator("#explain").isVisible());
    await page.locator("#explain").click();
    assert(await page.locator("#explanation-panel").isHidden());
    assert(await page.locator("#explain").isVisible());

    // Thai-safe minimum size across visible text on the phone layout.
    const tooSmall = await page.evaluate(() =>
      [...document.querySelectorAll("body *")]
        .filter((el) => {
          const rect = el.getBoundingClientRect();
          const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
          return own && rect.width && rect.height && parseFloat(getComputedStyle(el).fontSize) < 12;
        })
        .map((el) => `${el.tagName}#${el.id}.${el.className}`)
    );
    assert.deepEqual(tooSmall, [], "Visible text must be at least 12px");

    // Offline: the app explains that translation needs a connection.
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await page.locator("#offline-banner").waitFor();
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    assert(await page.locator("#offline-banner").isHidden());

    // Install assets: manifest is linked and the worker is served from the root.
    const manifest = await page.evaluate(async () => {
      const link = document.querySelector('link[rel="manifest"]');
      return (await fetch(link.href)).json();
    });
    assert.equal(manifest.start_url, "/");
    const worker = await page.request.get(base + "/sw.js");
    assert.equal(worker.status(), 200);
    assert.equal(worker.headers()["service-worker-allowed"], "/");
    assert.match(await worker.text(), /never stored/);

    // Thai menu shows Thai quick start text.
    await page.evaluate(() => localStorage.removeItem("translator-onboarding-v1"));
    await page.evaluate(() =>
      localStorage.setItem("translator-interface-v1", JSON.stringify({ language: "th" }))
    );
    await page.reload();
    await page.waitForFunction(() => locale === "th");
    assert.match(await page.locator("#onboarding-title").textContent(), /เริ่มใช้งาน/);
    assert.deepEqual(errors, []);
    console.log(
      "PASS quick start, direct review tools, 12px Thai minimum, offline notice and installable app shell."
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
