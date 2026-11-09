/* Server-free font privacy regression: local files only, no API or external network. */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ serviceWorkers: "block", offline: true });
    const page = await context.newPage();
    const origin = "http://translator.test";
    const staticRoot = path.resolve(__dirname, "../../static");
    const externalRequests = [],
      apiRequests = [],
      fontRequests = [],
      errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.origin !== origin) externalRequests.push(request.url());
      if (request.resourceType() === "font") fontRequests.push(request.url());
    });
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (url.pathname === "/api/language-catalog.js")
        return route.fulfill({
          contentType: "application/javascript",
          body: `const LANGUAGE_CATALOG = ${readFileSync(path.join(staticRoot, "language-catalog.json"), "utf8")};`,
        });
      if (url.pathname.startsWith("/api/")) {
        apiRequests.push(route.request().url());
        return route.abort();
      }
      if (url.pathname !== "/" && !url.pathname.startsWith("/static/")) return route.abort();
      const file = path.resolve(
        staticRoot,
        url.pathname === "/" ? "index.html" : url.pathname.slice("/static/".length)
      );
      if (!file.startsWith(`${staticRoot}${path.sep}`)) return route.abort();
      return route.fulfill({ path: file });
    });

    const assertLocalFontSources = async () => {
      const urls = await page.evaluate(() => {
        const urls = [...document.querySelectorAll("link[href]")].map((link) => link.href);
        const visit = (rules) => {
          for (const rule of rules) {
            if (rule instanceof CSSImportRule) {
              urls.push(rule.href);
              visit(rule.styleSheet.cssRules);
            } else if (rule instanceof CSSFontFaceRule) {
              for (const match of rule.style
                .getPropertyValue("src")
                .matchAll(/url\(["']?([^"')]+)/g))
                urls.push(new URL(match[1], location.href).href);
            } else if (rule.cssRules) visit(rule.cssRules);
          }
        };
        for (const sheet of document.styleSheets) {
          if (sheet.href) urls.push(sheet.href);
          visit(sheet.cssRules);
        }
        return urls;
      });
      for (const url of urls) assert.equal(new URL(url).origin, origin, url);
      assert.equal(
        await page.locator('link[rel="preconnect"], link[rel="dns-prefetch"]').count(),
        0
      );
      assert.deepEqual(
        externalRequests,
        [],
        "Startup and locale switching must not contact font CDNs"
      );
      assert.deepEqual(apiRequests, [], "Font/locale changes must not invoke application APIs");
    };

    await page.goto(origin);
    assert.equal(await page.evaluate(() => navigator.onLine), false);
    await page.waitForFunction(
      () => typeof changeInterfaceLanguage === "function" && locale === "en"
    );
    const startupLinks = await page.locator("link").count();
    await assertLocalFontSources();

    // Assert usable CSS stacks and layout, not glyph coverage: non-Latin/Thai fonts
    // are installed-system fallbacks and may be absent on a minimal test machine.
    for (const [code, family, sample] of [
      ["th", "IBM Plex Sans Thai", "ภาษาไทย"],
      ["zh", "Microsoft YaHei", "简体中文"],
      ["zh-TW", "Microsoft JhengHei", "繁體中文"],
      ["ja", "Yu Gothic", "日本語"],
      ["ko", "Malgun Gothic", "한국어"],
      ["ar", "Geeza Pro", "العربية"],
      ["he", "Arial Hebrew", "עברית"],
      ["hi", "Mangal", "हिन्दी"],
      ["bn", "Vrinda", "বাংলা"],
      ["ta", "Latha", "தமிழ்"],
      ["my", "Myanmar Text", "မြန်မာ"],
      ["km", "Leelawadee UI", "ខ្មែរ"],
      ["bo", "Microsoft Himalaya", "བོད་ཡིག"],
      ["en", "Manrope Brand", "Readable offline text"],
    ]) {
      await page.evaluate((code) => changeInterfaceLanguage(code), code);
      assert.equal(await page.evaluate(() => locale), code, `${code} must load offline`);
      const state = await page.evaluate(
        ([code, sample]) => {
          const probe = document.createElement("p");
          probe.lang = code;
          probe.textContent = sample;
          document.body.append(probe);
          const style = getComputedStyle(probe);
          const result = {
            font: style.fontFamily,
            size: parseFloat(style.fontSize),
            width: probe.getBoundingClientRect().width,
            height: probe.getBoundingClientRect().height,
            dir: document.documentElement.dir,
            rtl: !!LANGUAGE_CATALOG[code]?.rtl,
            heading: document.querySelector("#menu-heading").textContent,
            expectedHeading: COPY[code].menu,
          };
          probe.remove();
          return result;
        },
        [code, sample]
      );
      assert(state.font.includes(family), `${code}: ${state.font}`);
      for (const fallback of ["IBM Plex Sans Thai", "system-ui", "sans-serif"])
        assert(state.font.includes(fallback), `${code} needs ${fallback}: ${state.font}`);
      assert(
        state.size >= 12 && state.width > 0 && state.height > 0,
        `${code} must remain readable`
      );
      assert.equal(state.dir, state.rtl ? "rtl" : "ltr", `${code} direction`);
      assert.equal(state.heading, state.expectedHeading);
      assert.equal(await page.locator("#input").getAttribute("dir"), "auto");
      assert.equal(await page.locator("#output").getAttribute("dir"), "auto");
      assert.equal(await page.locator("link").count(), startupLinks, "No dynamic font links");
      await page.evaluate(() => document.fonts.ready);
      await assertLocalFontSources();
    }

    for (const [family, sample] of [
      ["Manrope Brand", "Offline"],
      ["Space Grotesk Brand", "TH AI"],
      ["IBM Plex Sans Thai", "ภาษาไทย"],
    ]) {
      assert(
        await page.evaluate(
          async ([family, sample]) => {
            const fonts = await document.fonts.load(`16px "${family}"`, sample);
            return fonts.length > 0 && fonts.every((font) => font.status === "loaded");
          },
          [family, sample]
        ),
        `${family} must load from bundled files offline`
      );
    }
    assert(fontRequests.length > 0, "Exercise real browser font loading");
    for (const url of fontRequests) assert(url.startsWith(`${origin}/static/fonts/`), url);

    await page.evaluate(() => changeInterfaceLanguage("ar"));
    await page.reload();
    await page.waitForFunction(() => locale === "ar");
    assert.equal(await page.locator("html").getAttribute("dir"), "rtl");
    assert(
      (await page.locator("body").evaluate((el) => getComputedStyle(el).fontFamily)).includes(
        "Geeza Pro"
      )
    );
    await page.evaluate(() => document.fonts.ready);
    await assertLocalFontSources();
    assert.deepEqual(errors, []);
    console.log(
      "PASS offline local Latin/Thai fonts, system multilingual stacks, no external font URLs/requests, locale switching and persisted RTL."
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
