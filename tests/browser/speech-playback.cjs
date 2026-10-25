const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors = [],
      requests = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      const synthesis = new EventTarget();
      window.testVoices = [];
      window.spoken = [];
      window.audioPlays = 0;
      window.failVoice = false;
      window.holdVoice = false;
      synthesis.getVoices = () => window.testVoices;
      synthesis.cancel = () => {};
      synthesis.speak = (utterance) => {
        window.spoken.push({ text: utterance.text, lang: utterance.lang });
        if (!window.holdVoice)
          setTimeout(() => {
            if (window.failVoice) utterance.onerror?.({ error: "synthesis-failed" });
            else utterance.onend?.();
          }, 20);
      };
      Object.defineProperty(window, "speechSynthesis", { value: synthesis, configurable: true });
      window.SpeechSynthesisUtterance = class {
        constructor(text) {
          this.text = text;
        }
      };
      window.Audio = class {
        async play() {
          window.audioPlays++;
        }
        pause() {}
        removeAttribute() {}
        load() {}
      };
      window.installVoice = (lang) => {
        window.testVoices = [{ name: "Device voice", lang, voiceURI: lang }];
        synthesis.dispatchEvent(new Event("voiceschanged"));
      };
    });
    let failServer = false,
      lateVoice = false;
    await page.route("**/api/speech", async (route) => {
      requests.push(route.request().postDataJSON());
      if (lateVoice) await page.evaluate(() => installVoice("th-TH"));
      await route.fulfill(
        failServer
          ? {
              status: 503,
              json: { error: "Speech temporarily unavailable" },
            }
          : { contentType: "audio/mpeg", body: Buffer.from("ID3test") }
      );
    });
    await page.goto(process.env.TRANSLATOR_TEST_URL || "http://127.0.0.1:5000");
    await page.evaluate(async () => {
      setTimeout(() => installVoice("th-TH"), 80);
      await speak("สวัสดี", "th", document.querySelector("#speak-source"));
    });
    assert.equal(
      requests.length,
      0,
      "Wait for device voices instead of unnecessarily calling the server"
    );
    assert.equal((await page.evaluate(() => spoken)).length, 1);

    await page.evaluate(async () => {
      installVoice("zh-TW");
      await speak("你好", "zh-TW", document.querySelector("#speak-source"));
    });
    assert.equal(requests.length, 0, "Language matching must ignore locale casing");
    assert.equal((await page.evaluate(() => spoken)).at(-1).lang, "zh-TW");

    await page.evaluate(async () => {
      installVoice("th-TH");
      failVoice = true;
      await speak("อ่านจากเซิร์ฟเวอร์", "th", document.querySelector("#speak-source"));
    });
    assert.equal(requests.length, 1, "Failed device playback falls back to server audio");
    assert.equal(await page.evaluate(() => audioPlays), 1);

    failServer = true;
    lateVoice = true;
    await page.evaluate(async () => {
      stopAudio();
      testVoices = [];
      failVoice = false;
      await speak("เสียงสำรองในเครื่อง", "th", document.querySelector("#speak-source"));
    });
    assert.equal(requests.length, 2);
    assert.equal((await page.evaluate(() => spoken)).at(-1).text, "เสียงสำรองในเครื่อง");
    assert.equal(await page.locator("#voice-status").textContent(), "");

    await page.evaluate(() => {
      installVoice("th-TH");
      holdVoice = true;
      window.pendingSpeech = speak("cancel this", "th", document.querySelector("#speak-source"));
    });
    await page.waitForFunction(() => spoken.at(-1)?.text === "cancel this");
    const before = requests.length;
    await page.evaluate(async () => {
      switchFeature("image");
      await pendingSpeech;
    });
    assert.equal(requests.length, before, "Canceling must not launch fallback in another feature");
    assert.deepEqual(errors, []);
    console.log(
      "PASS delayed device voices, locale matching, server/device fallback, and canceled playback isolation."
    );
  } finally {
    await browser.close();
  }
})();
