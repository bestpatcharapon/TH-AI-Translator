const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const audioFixture = require("./audio-fixture.cjs");

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", audioFixture()],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
      permissions: ["microphone"],
    });
    await page.addInitScript(() => {
      const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = (options) => {
        window.captureOptions = options;
        return original(options);
      };
    });
    const errors = [],
      translations = [];
    page.on("pageerror", (error) => errors.push(error.message));
    let uncertain = false,
      transcriptions = 0,
      transcript = "ขอจองโต๊ะสองคนครับ";
    await page.route("**/api/transcribe", (route) => {
      transcriptions++;
      return route.fulfill({ json: { text: transcript, review_required: uncertain } });
    });
    await page.route("**/api/translate", (route) => {
      translations.push(route.request().postDataJSON());
      return route.fulfill({
        json: { translation: "A table for two, please.", source_language: "th" },
      });
    });
    await page.goto(process.env.TRANSLATOR_TEST_URL || "http://127.0.0.1:5000");
    await page.evaluate(() => {
      switchFeature("live");
      document.querySelector("#auto-speak").checked = false;
    });
    async function record() {
      await page.locator("#live-mic-forward").click();
      await page.waitForFunction(
        () => document.querySelector("#microphone").dataset.voiceState === "recording"
      );
      await page.waitForTimeout(150);
      await page.locator("#live-mic-forward").click();
    }
    assert.equal(await page.locator("#live-review-voice").isChecked(), false);
    await record();
    await page.waitForFunction(() => document.querySelectorAll(".chat-turn").length === 1);
    assert.equal(translations[0].text, transcript);
    await page.locator("#live-review-voice").check();
    await record();
    await page.waitForFunction(
      () => document.querySelector("#input").value === "ขอจองโต๊ะสองคนครับ"
    );
    assert.equal(translations.length, 1);
    assert.match(await page.locator("#voice-status").textContent(), /Check or edit/);
    const capture = await page.evaluate(() => window.captureOptions.audio);
    assert.equal(capture.noiseSuppression, true);
    assert.equal(capture.echoCancellation, true);
    assert.equal(capture.channelCount.ideal, 1);
    await page.locator("#input").fill("ขอจองโต๊ะสามคนครับ");
    await page.locator("#live-send").click();
    await page.waitForFunction(() => document.querySelectorAll(".chat-turn").length === 2);
    assert.equal(translations[1].text, "ขอจองโต๊ะสามคนครับ");
    await page.locator("#live-review-voice").uncheck();
    uncertain = true;
    transcript = "คำที่ยังไม่แน่ใจ";
    await record();
    await page.waitForFunction(() => document.querySelector("#input").value === "คำที่ยังไม่แน่ใจ");
    assert.equal(translations.length, 2);
    assert.match(await page.locator("#voice-status").textContent(), /unclear/);
    await page.locator("#live-send").click();
    await page.waitForFunction(() => document.querySelectorAll(".chat-turn").length === 3);
    uncertain = false;
    transcript = "ขอบคุณครับ";
    await record();
    await page.waitForFunction(() => document.querySelectorAll(".chat-turn").length === 4);
    assert.equal(translations.at(-1).text, "ขอบคุณครับ");
    await page.locator("#live-back").click();
    await page.locator('[data-mode="live"]').click();
    assert.equal(await page.locator("#live-review-voice").isChecked(), false);
    const beforeSilence = transcriptions;
    await page.evaluate(() => {
      navigator.mediaDevices.getUserMedia = async () => {
        const context = new AudioContext();
        const destination = context.createMediaStreamDestination();
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        gain.gain.value = 0;
        oscillator.connect(gain).connect(destination);
        oscillator.start();
        await context.resume();
        window.silentAudioContext = context;
        return destination.stream;
      };
    });
    await record();
    await page.waitForFunction(() =>
      document.querySelector("#voice-status").textContent.includes("No speech detected")
    );
    assert.equal(transcriptions, beforeSilence);
    assert.equal(translations.length, 4);
    await page.evaluate(() => window.silentAudioContext.close());
    assert.deepEqual(errors, []);
    console.log(
      "PASS microphone capture settings, automatic send by default, optional transcript review, edited source, uncertain-audio gate, feature-owned preference and digital-silence rejection."
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
