const { chromium } = require("playwright");

(async () => {
  // Requires a running Flask app, like the browser tests. Uses TRANSLATOR_TEST_URL.
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 393, height: 852 } });
    const page = await context.newPage();
    const base = process.env.TRANSLATOR_TEST_URL || "http://127.0.0.1:5000";

    await page.goto(base, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    const cold = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0];
      const resources = performance.getEntriesByType("resource");
      const total = resources.reduce((sum, entry) => sum + (entry.transferSize || 0), 0);
      const largest = resources
        .map((entry) => ({
          name: new URL(entry.name).pathname,
          kb: Math.round((entry.transferSize || 0) / 1024),
          ms: Math.round(entry.duration),
        }))
        .sort((a, b) => b.kb - a.kb)
        .slice(0, 8);
      return {
        dclMs: Math.round(nav.domContentLoadedEventEnd),
        loadMs: Math.round(nav.loadEventEnd),
        fcpMs: Math.round(
          performance.getEntriesByName("first-contentful-paint")[0]?.startTime || 0
        ),
        requests: resources.length,
        transferKb: Math.round(total / 1024),
        domNodes: document.querySelectorAll("*").length,
        largest,
      };
    });

    await page.reload({ waitUntil: "load" });
    const warm = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0];
      return {
        dclMs: Math.round(nav.domContentLoadedEventEnd),
        loadMs: Math.round(nav.loadEventEnd),
        requests: performance.getEntriesByType("resource").length,
      };
    });

    // Long-text typing: measure input handler + auto-translate debounce behaviour.
    await page.route("**/api/translate", (route) =>
      route.fulfill({ json: { translation: "ok", source_language: "th" } })
    );
    const typing = await page.evaluate(async () => {
      const input = document.querySelector("#input");
      const text = "ทดสอบการพิมพ์ข้อความยาว ".repeat(200);
      const started = performance.now();
      input.value = text;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      const handlerMs = performance.now() - started;
      await new Promise((resolve) => setTimeout(resolve, 800));
      return { handlerMs: Math.round(handlerMs), chars: text.length };
    });

    console.log(JSON.stringify({ cold, warm, typing }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
