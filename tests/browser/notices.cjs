const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.clock.install({ time: new Date("2026-10-26T00:00:00Z") });
    await page.clock.pauseAt(new Date("2026-10-26T00:00:01Z"));
    await page.goto(process.env.TRANSLATOR_TEST_URL || "http://127.0.0.1:5000");
    const ids = [
      "status",
      "live-status",
      "voice-status",
      "file-status",
      "source-info-status",
      "reply-status",
      "menu-status",
      "glossary-status",
      "thai-lexicon-status",
      "photo-status",
      "photo-label-status",
      "photo-camera-status",
      "interface-language-status",
      "studio-status",
    ];
    await page.evaluate((ids) => {
      for (const id of ids) {
        document.getElementById(id).textContent = `Notice: ${id}`;
        document.getElementById(id).classList.add("error");
      }
    }, ids);
    await page.clock.fastForward(2999);
    assert(
      await page.evaluate((ids) => ids.every((id) => document.getElementById(id).textContent), ids)
    );
    await page.clock.fastForward(1);
    assert(
      await page.evaluate(
        (ids) =>
          ids.every((id) => {
            const node = document.getElementById(id);
            return !node.textContent && !node.classList.contains("error");
          }),
        ids
      )
    );

    // A fresh notice, including a repeated identical message, gets its own three seconds.
    await page.evaluate(() => setStatus(t("copied")));
    await page.clock.fastForward(2000);
    await page.evaluate(() => setStatus(t("copied")));
    await page.clock.fastForward(1000);
    assert(await page.locator("#status").textContent());
    await page.clock.fastForward(1999);
    assert(await page.locator("#status").textContent());
    await page.clock.fastForward(1);
    assert.equal(await page.locator("#status").textContent(), "");

    // Work-in-progress and actual AI output are content, not transient notices.
    await page.evaluate(() => {
      setStatus(t("loading"));
      voiceStatus(t("recording"));
      fileStatus(t("extracting"));
      featureStatus("reply-status", t("working"));
      document.getElementById("explanation-text").textContent = "A useful explanation.";
      document.getElementById("check-text").textContent = "A translation review.";
    });
    await page.clock.fastForward(5000);
    for (const id of [
      "status",
      "voice-status",
      "file-status",
      "reply-status",
      "explanation-text",
      "check-text",
    ])
      assert(await page.locator(`#${id}`).textContent(), `${id} must remain`);
    await page.evaluate(() => featureStatus("explanation-text", "Review unavailable", true));
    await page.clock.fastForward(3000);
    assert.equal(await page.locator("#explanation-text").textContent(), "");

    // A departed feature cannot resurrect its notice or clear another feature's message.
    await page.evaluate(() => {
      setStatus(t("copied"));
      switchFeature("document");
      setStatus("New feature notice");
    });
    await page.clock.fastForward(2000);
    assert.equal(await page.locator("#status").textContent(), "New feature notice");
    await page.evaluate(() => switchFeature("text"));
    assert.equal(await page.locator("#status").textContent(), "");
    await page.clock.fastForward(5000);
    assert.deepEqual(errors, []);
    console.log(
      "PASS 3-second notices across app/menu/photo/voice/studio; replacement timers, progress, review content and feature isolation."
    );
  } finally {
    await browser.close();
  }
})();
