/* Read actual Google Translate UI and this project's API. No translation proxies. */
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const option = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : process.argv[index + 1];
};
const directory = path.resolve(root, option("--out-dir", "reports/google-comparison"));
fs.mkdirSync(directory, { recursive: true });
const output = path.join(directory, "results.json");
const caseFile = path.resolve(root, option("--cases", path.join(directory, "cases.json")));
const cases = JSON.parse(fs.readFileSync(caseFile));
const scope = option("--scope", "text");
// Catalog codes that Google Translate's URL spells differently.
const googleCodes = { zh: "zh-CN", he: "iw", jv: "jw" };
const googleCode = (code) => googleCodes[code] || code;

(async () => {
  if (!process.argv.includes("--live"))
    throw Error("Pass --live: sends test text to Google and uses this project's API quota.");
  const resume = process.argv.includes("--resume");
  if (fs.existsSync(output) && !resume && !process.argv.includes("--overwrite"))
    throw Error("Report exists. Choose a new --out-dir, or explicitly use --overwrite / --resume.");
  if (caseFile !== path.join(directory, "cases.json"))
    fs.copyFileSync(caseFile, path.join(directory, "cases.json"));
  const report =
    resume && fs.existsSync(output)
      ? JSON.parse(fs.readFileSync(output))
      : {
          started_at: new Date().toISOString(),
          methodology: `${cases.length} hand-selected Thai-English/English-Thai cases. Same raw text and explicit language pair; no glossary, dialect hints or conversation. Google public signed-out desktop website, displayed mode recorded, versus app /api/translate scope=${scope} with natural tone/general context and cache bypass. One run; qualitative inspection is not a human blind benchmark or a population accuracy score. No images/audio comparison. UI time and API time are different channels, not a fair speed ranking.`,
          app_configuration: JSON.parse(
            execFileSync(
              path.join(root, ".venv/bin/python"),
              [
                "-c",
                "import json; from project_config import MODEL, TRANSLATION_REASONING_EFFORT, CHAT_REASONING_EFFORT; print(json.dumps(dict(model=MODEL,text_reasoning=TRANSLATION_REASONING_EFFORT,chat_reasoning=CHAT_REASONING_EFFORT)))",
              ],
              { cwd: root, encoding: "utf8" }
            )
          ),
          code_sha256: Object.fromEntries(
            [
              "app.py",
              "semantic_review.py",
              "project_config.py",
              "practical_translation.py",
              "linguistic_guidance.py",
            ].map((file) => [
              file,
              crypto
                .createHash("sha256")
                .update(fs.readFileSync(path.join(root, file)))
                .digest("hex"),
            ])
          ),
          results: [],
        };
  const save = () => fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      locale: "en-US",
    });
    const page = await context.newPage();
    for (const sample of cases) {
      let row = report.results.find((row) => row.id === sample.id);
      if (!row) {
        row = { ...sample };
        report.results.push(row);
      }
      const requestedWork = !row.app?.translation || !row.google?.translation;
      if (!row.app?.translation) {
        row.app_attempts ||= [];
        if (row.app && !row.app_attempts.length) row.app_attempts.push(row.app);
        const started = Date.now();
        try {
          const response = await context.request.post(
            (process.env.TRANSLATOR_TEST_URL || "http://127.0.0.1:5000") + "/api/translate",
            {
              data: {
                text: sample.text,
                source: sample.source,
                target: sample.target,
                tone: "natural",
                context: "general",
                cache_scope: scope,
                cache_bypass: true,
              },
              timeout: 120000,
            }
          );
          const data = await response.json();
          row.app = {
            ...data,
            http_status: response.status(),
            seconds: (Date.now() - started) / 1000,
            captured_at: new Date().toISOString(),
          };
        } catch (error) {
          row.app = { error: error.message, seconds: (Date.now() - started) / 1000 };
        }
        row.app_attempts.push(row.app);
        save();
      }
      if (!row.google?.translation) {
        const url =
          "https://translate.google.com/?" +
          new URLSearchParams({
            sl: googleCode(sample.source),
            tl: googleCode(sample.target),
            text: sample.text,
            op: "translate",
          });
        const started = Date.now();
        try {
          await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
          await page.waitForFunction(
            () => {
              const body = document.body.innerText;
              const section = body
                .split("Translation results\n")[1]
                ?.split("\nSend feedback")[0]
                ?.trim();
              return (
                section &&
                !/^(Translation|Translating\.\.\.|Getting translation\.\.\.)$/.test(section) &&
                !section.includes("Translation error") &&
                document.querySelector("textarea")
              );
            },
            {},
            { timeout: 45000 }
          );
          await page.waitForTimeout(700);
          const data = await page.evaluate(() => {
            const body = document.body.innerText;
            const translation = body
              .split("Translation results\n")[1]
              ?.split("\nSend feedback")[0]
              ?.trim();
            const mode = body.match(/(?:^|\n)(Advanced|Classic)(?:\n|$)/)?.[1] || "not visible";
            return {
              translation,
              displayed_mode: mode,
              body_text: body,
              source_fields: [...document.querySelectorAll("textarea")].map((el) => el.value),
            };
          });
          if (!data.translation || !data.source_fields.includes(sample.text))
            throw Error("Could not verify rendered translation and exact source text");
          row.google = {
            ...data,
            url,
            seconds: (Date.now() - started) / 1000,
            captured_at: new Date().toISOString(),
            screenshot: sample.id + ".png",
          };
          await page.screenshot({
            path: path.join(directory, row.google.screenshot),
            fullPage: true,
          });
        } catch (error) {
          row.google = { url, error: error.message, seconds: (Date.now() - started) / 1000 };
        }
        save();
      }
      console.log(
        row.id,
        JSON.stringify({
          google: row.google?.translation || row.google?.error,
          mode: row.google?.displayed_mode,
          app: row.app?.translation || row.app?.error,
        })
      );
      if (requestedWork) await page.waitForTimeout(Number(option("--pause-ms", "0")));
    }
    report.finished_at = new Date().toISOString();
    save();
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
