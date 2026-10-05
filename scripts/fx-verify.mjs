#!/usr/bin/env node
/**
 * Fx verification suite (Playwright, headless Chromium on SwiftShader).
 *
 *   npm run build && FX_HARNESS=1 npx next start -p 3100   # in one shell
 *   FX_BASE=http://localhost:3100 node scripts/fx-verify.mjs
 *
 * Checks per harness route: WebGL really runs (SwiftShader renderer string), live context
 * count, rAF frame-time percentiles, no console errors, reduced-motion still frame,
 * pause/resume on visibilitychange, and audio analysis on the kick fixture.
 * Frame times are CPU-rendered baselines for relative comparison, not real-GPU numbers.
 *
 * Playwright isn't a project dependency: set PLAYWRIGHT_PATH or have it resolvable.
 */
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.FX_BASE ?? "http://localhost:3100";
const OUT = process.env.FX_OUT ?? path.resolve("fx-report");
const STRICT_DEV = process.env.FX_DEV === "1";

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    const p = process.env.PLAYWRIGHT_PATH ?? "/opt/node-tools/node_modules/playwright/index.mjs";
    return await import(p);
  }
}

const { chromium } = await loadPlaywright();

// The sandbox's TLS proxy isn't in Chromium's trust store (affects the Google Fonts link only)
const CONTEXT_OPTS = { ignoreHTTPSErrors: true };

const LAUNCH_ARGS = [
  "--use-angle=swiftshader",
  "--use-gl=angle",
  "--enable-unsafe-swiftshader",
  "--ignore-gpu-blocklist",
  "--autoplay-policy=no-user-gesture-required",
];

/** Counts every WebGL context created and how many are still alive (not lost). */
const COUNT_CONTEXTS = () => {
  const live = new Set();
  let created = 0;
  const orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    const ctx = orig.call(this, type, ...rest);
    if (ctx && /webgl/.test(type) && !live.has(ctx)) {
      live.add(ctx);
      created++;
    }
    return ctx;
  };
  window.__gl = () => ({ created, live: [...live].filter((g) => !g.isContextLost()).length });
};

const ROUTES = [
  { name: "bell-field-studio", path: "/fx-harness/bell-field?room=studio", maxLive: 1 },
  { name: "bell-field-lobby", path: "/fx-harness/bell-field?room=lobby", maxLive: 1 },
  { name: "bell-field-source", path: "/fx-harness/bell-field?room=studio&source=1", maxLive: 1 },
  { name: "emerald-horizon-lobby", path: "/fx-harness/emerald-horizon?room=lobby", maxLive: 1 },
  { name: "emerald-horizon-studio", path: "/fx-harness/emerald-horizon?room=studio", maxLive: 1 },
  { name: "emerald-horizon-source", path: "/fx-harness/emerald-horizon?room=lobby&source=1", maxLive: 1 },
];

const results = [];
let failures = 0;
const check = (route, name, ok, detail) => {
  results.push({ route, check: name, ok, detail });
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${route.padEnd(26)} ${name}${detail ? `  ${JSON.stringify(detail)}` : ""}`);
};

async function sampleFrames(page, ms) {
  return page.evaluate(
    (duration) =>
      new Promise((resolve) => {
        const deltas = [];
        let last = performance.now();
        const start = last;
        const step = (now) => {
          deltas.push(now - last);
          last = now;
          if (now - start < duration) requestAnimationFrame(step);
          else {
            const sorted = [...deltas].sort((a, b) => a - b);
            const q = (p) => +sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))].toFixed(1);
            resolve({ frames: deltas.length, p50: q(0.5), p95: q(0.95), max: q(1), over34: deltas.filter((d) => d > 34).length });
          }
        };
        requestAnimationFrame(step);
      }),
    ms
  );
}

const stageFrames = (page) =>
  page.evaluate(() => (window.__fx?.stats().stages ?? []).reduce((n, s) => n + s.frames, 0));

const setHidden = (page, hidden) =>
  page.evaluate((h) => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => h });
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (h ? "hidden" : "visible") });
    document.dispatchEvent(new Event("visibilitychange"));
  }, hidden);

fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: LAUNCH_ARGS });

// ── GL sanity ──────────────────────────────────────────────────────────────────
{
  const page = await browser.newPage(CONTEXT_OPTS);
  const info = await page.evaluate(() => {
    const gl = document.createElement("canvas").getContext("webgl");
    if (!gl) return null;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  });
  check("browser", "webgl available (SwiftShader)", !!info && /swiftshader/i.test(info), { renderer: info });
  await page.close();
}

// ── Per-route checks ──────────────────────────────────────────────────────────
for (const route of ROUTES) {
  const context = await browser.newContext({ ...CONTEXT_OPTS, viewport: { width: 1440, height: 900 } });
  await context.addInitScript(COUNT_CONTEXTS);
  const page = await context.newPage();
  const errors = [];
  const notes = [];
  const sameOrigin = (url) => !url || url.startsWith(BASE);
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    const url = m.location()?.url;
    if (/too many active webgl contexts/i.test(m.text())) errors.push(m.text());
    else if (m.type() === "error") (sameOrigin(url) ? errors : notes).push(`${m.text()} ${url ?? ""}`.trim());
  });
  // Third-party fetches (Google Fonts) go through the sandbox proxy and can flake; record, don't fail
  page.on("requestfailed", (r) => {
    const line = `${r.failure()?.errorText ?? "failed"} ${r.url()}`;
    (sameOrigin(r.url()) ? errors : notes).push(line);
  });

  await page.goto(BASE + route.path, { waitUntil: "networkidle" });
  const live = await page
    .waitForSelector('[data-fx-state="live"]', { timeout: 20000 })
    .then(() => true)
    .catch(() => false);
  check(route.name, "stage reaches live", live);
  if (!live) {
    await page.screenshot({ path: path.join(OUT, `${route.name}-failed.png`) });
    await context.close();
    continue;
  }

  await page.waitForTimeout(1500);
  const timing = await sampleFrames(page, 4000);
  const gl = await page.evaluate(() => window.__gl());
  const fx = await page.evaluate(() => ({ live: window.__fx.live(), stats: window.__fx.stats() }));
  check(route.name, `live webgl contexts <= ${route.maxLive}`, gl.live <= route.maxLive, gl);
  check(route.name, "runtime lease count matches", fx.live === gl.live, { leases: fx.live });
  check(route.name, "frames rendering", timing.frames > 20, timing);
  await page.screenshot({ path: path.join(OUT, `${route.name}.png`) });

  // Visibility: frames freeze while hidden and resume after
  const before = await stageFrames(page);
  await setHidden(page, true);
  await page.waitForTimeout(800);
  const hiddenA = await stageFrames(page);
  await page.waitForTimeout(800);
  const hiddenB = await stageFrames(page);
  await setHidden(page, false);
  await page.waitForTimeout(800);
  const after = await stageFrames(page);
  check(route.name, "pauses when hidden", hiddenB === hiddenA, { before, hiddenA, hiddenB });
  check(route.name, "resumes when visible", after > hiddenB, { after });

  check(route.name, "no same-origin console/page errors", errors.length === 0, errors.slice(0, 3));
  results.push({ route: route.name, timing, ticker: fx.stats, notes });
  await context.close();
}

// ── Reduced motion: one still frame, nothing ticking ─────────────────────────────
for (const route of ROUTES.filter((r) => !r.name.endsWith("source"))) {
  const context = await browser.newContext({ ...CONTEXT_OPTS, viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto(BASE + route.path, { waitUntil: "networkidle" });
  const live = await page
    .waitForSelector('[data-fx-state="live"]', { timeout: 20000 })
    .then(() => true)
    .catch(() => false);
  check(`${route.name}`, "reduced motion: still frame shown", live);
  if (live) {
    await page.waitForTimeout(800);
    const a = await page.screenshot();
    await page.waitForTimeout(1000);
    const b = await page.screenshot();
    const ticking = await stageFrames(page);
    check(route.name, "reduced motion: frame is static", a.equals(b) && ticking === 0, { ticking });
    fs.writeFileSync(path.join(OUT, `${route.name}-reduced.png`), b);
  }
  await context.close();
}

// ── Audio: analyser sees the fixture and detects kicks ─────────────────────────
{
  const context = await browser.newContext({ ...CONTEXT_OPTS, viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.goto(BASE + "/fx-harness/bell-field?room=studio&audio=1", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-fx-state="live"]', { timeout: 20000 }).catch(() => {});
  await page.click('[data-testid="play-fixture"]');
  await page.waitForTimeout(4500);
  const audio = await page.evaluate(() => window.__fx.audio());
  check("audio", "analyser graph created", audio.analyser, audio);
  check("audio", "spectrum non-zero", audio.binsMax > 0, { binsMax: audio.binsMax, rmsMax: audio.rmsMax });
  check("audio", "kick onsets detected", audio.onsets >= 3, { onsets: audio.onsets, frames: audio.frames });
  await page.screenshot({ path: path.join(OUT, "audio-bell-field.png") });
  await context.close();
}

// ── Dev only: StrictMode double-mount must not leak contexts ───────────────────
if (STRICT_DEV) {
  const context = await browser.newContext(CONTEXT_OPTS);
  await context.addInitScript(COUNT_CONTEXTS);
  const page = await context.newPage();
  await page.goto(BASE + "/fx-harness/bell-field?room=studio", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-fx-state="live"]', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const gl = await page.evaluate(() => window.__gl());
  check("strict-dev", "one live context after StrictMode remount", gl.live === 1, gl);
  await context.close();
}

await browser.close();
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify({ base: BASE, failures, results }, null, 2));
console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}  →  ${OUT}`);
process.exit(failures === 0 ? 0 : 1);
