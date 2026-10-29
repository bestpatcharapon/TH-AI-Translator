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
      translations = [],
      speechUploads = [];
    page.on("pageerror", (error) => errors.push(error.message));
    let uncertain = false,
      reviewReasons = [],
      transcriptions = 0,
      transcript = "ขอจองโต๊ะสองคนครับ";
    await page.route("**/api/transcribe", (route) => {
      transcriptions++;
      speechUploads.push(route.request().postData());
      return route.fulfill({
        json: { text: transcript, review_required: uncertain, review_reasons: reviewReasons },
      });
    });
    await page.route("**/api/translate", (route) => {
      translations.push(route.request().postDataJSON());
      return route.fulfill({
        json: { translation: "A table for two, please.", source_language: "th" },
      });
    });
    await page.goto(process.env.TRANSLATOR_TEST_URL || "http://127.0.0.1:5000");
    await page.evaluate(() => {
      featureWorkspaces.get("text").glossary = [
        { source: "TextOnlyName", target: "Text name", language: "en" },
      ];
      featureWorkspaces.get("text").thai.lexicon = [
        { term: "คำเฉพาะข้อความ", meaning: "คำของโหมดข้อความ", dialect: "slang", example: "" },
      ];
      switchFeature("live");
      activeFeature().glossary = [{ source: "NECTEC", target: "NECTEC", language: "en" }];
      activeFeature().thai.lexicon = [
        { term: "ด้อม", meaning: "กลุ่มแฟนคลับ", dialect: "slang", example: "" },
      ];
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
    assert.match(speechUploads[0], /NECTEC/);
    assert.match(speechUploads[0], /ด้อม/);
    assert.doesNotMatch(speechUploads[0], /TextOnlyName/);
    assert.doesNotMatch(speechUploads[0], /คำเฉพาะข้อความ/);
    assert.match(speechUploads[0], /name="verify"\r\n\r\n1/);
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
    reviewReasons = ["possible_word_confusion"];
    transcript = "ฉันอยู่ 2 ดอมเมนของฉันคือมือกล่อง";
    const savedBeforeReview = await page.evaluate(() => savedTranslations.length);
    await record();
    await page.waitForFunction(
      () => document.querySelector("#input").value === "ฉันอยู่ 2 ดอมเมนของฉันคือมือกล่อง"
    );
    await page.waitForTimeout(700);
    assert.equal(translations.length, 2);
    assert.equal(await page.locator(".chat-turn").count(), 2);
    assert.equal(await page.evaluate(() => savedTranslations.length), savedBeforeReview);
    assert.equal(await page.evaluate(() => conversation.length), 2);
    assert.match(await page.locator("#voice-status").textContent(), /unclear/);
    await page.locator("#input").fill("ฉันอยู่สองด้อม เมนของฉันคือมือกลอง");
    await page.waitForTimeout(700);
    assert.equal(translations.length, 2, "Editing the flagged transcript must wait for Send");
    await page.locator("#live-send").click();
    await page.waitForFunction(() => document.querySelectorAll(".chat-turn").length === 3);
    assert.equal(translations[2].text, "ฉันอยู่สองด้อม เมนของฉันคือมือกลอง");
    assert(
      await page.evaluate(() =>
        savedTranslations.every((item) => item.text !== "ฉันอยู่ 2 ดอมเมนของฉันคือมือกล่อง")
      )
    );
    uncertain = false;
    reviewReasons = [];
    transcript = "ขอบคุณครับ";
    await record();
    await page.waitForFunction(() => document.querySelectorAll(".chat-turn").length === 4);
    assert.equal(translations.at(-1).text, "ขอบคุณครับ");
    // A temporary verifier outage alone must not override automatic send.
    uncertain = true;
    reviewReasons = ["verification_unavailable"];
    transcript = "ได้เลยครับ";
    await record();
    await page.waitForFunction(() => document.querySelectorAll(".chat-turn").length === 5);
    assert.equal(translations.at(-1).text, transcript);
    await page.locator("#live-review-voice").check();
    transcript = "ตรวจข้อความนี้ก่อน";
    await record();
    await page.waitForFunction(
      () => document.querySelector("#input").value === "ตรวจข้อความนี้ก่อน"
    );
    assert.equal(translations.length, 5, "Explicit review still waits during verifier outage");
    await page.locator("#input").fill("");
    await page.locator("#live-review-voice").uncheck();
    reviewReasons = ["verification_unavailable", "unclear_audio"];
    transcript = "ข้อความเสียงไม่ชัด";
    await record();
    await page.waitForFunction(
      () => document.querySelector("#input").value === "ข้อความเสียงไม่ชัด"
    );
    assert.equal(translations.length, 5, "Actual unclear audio must still require review");
    assert.match(await page.locator("#voice-status").textContent(), /unclear/);
    await page.locator("#input").fill("");
    uncertain = false;
    reviewReasons = [];
    await page.locator("#thai-mode").selectOption("northern", { force: true });
    transcript = "ฮาจะไปนอน";
    await record();
    await page.waitForFunction(() => document.querySelectorAll(".chat-turn").length === 6);
    assert.equal(translations.at(-1).thai_mode, "northern");
    assert.equal(translations.at(-1).text, transcript);
    await page.locator("#live-back").click();
    await page.locator('[data-mode="live"]').click();
    assert.equal(await page.locator("#live-review-voice").isChecked(), false);
    const beforeSilence = transcriptions;
    const beforeSilentTranslations = translations.length;
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
    assert.equal(translations.length, beforeSilentTranslations);
    await page.evaluate(() => window.silentAudioContext.close());
    assert.deepEqual(errors, []);
    console.log(
      "PASS automatic send including verifier outage and clear dialect speech, reviewed slang corrections before send/history, feature-owned ASR vocabulary, capture settings and silence rejection."
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
