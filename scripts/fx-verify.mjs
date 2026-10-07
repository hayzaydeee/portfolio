#!/usr/bin/env node
/**
 * Fx verification suite (Playwright, headless Chromium on SwiftShader).
 *
 *   npm run build && FX_HARNESS=1 npx next start -p 3100   # in one shell
 *   FX_BASE=http://localhost:3100 node scripts/fx-verify.mjs
 *
 * Checks per harness route: WebGL really runs (SwiftShader renderer string), live context
 * count, rAF frame-time percentiles, no console errors, reduced-motion still frame,
 * pause/resume on visibilitychange, and audio analysis on the kick fixture. Then the
 * chrome on real routes: the dock in every room, room visibility, magnification, the
 * portal between rooms (state walk, one push, focus, back/forward, reduced motion), the
 * context budget over repeated laps, and the splash handing its logo to the dock.
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

/** Effective canvas opacity before and at the moment a stage goes live (catches fade bypass) */
const FADE_PROBE = () => {
  window.__fade = { preLiveMax: 0, firstLive: null };
  const tick = () => {
    for (const host of document.querySelectorAll("[data-fx]")) {
      const layer = host.children[1];
      if (!layer) continue;
      const lo = parseFloat(getComputedStyle(layer).opacity);
      for (const c of layer.querySelectorAll("canvas")) {
        const eff = lo * parseFloat(getComputedStyle(c).opacity);
        if (host.dataset.fxState !== "live") window.__fade.preLiveMax = Math.max(window.__fade.preLiveMax, eff);
        else if (window.__fade.firstLive === null) window.__fade.firstLive = eff;
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

const ROUTES = [
  { name: "bell-field-studio", path: "/fx-harness/bell-field?room=studio", maxLive: 1 },
  { name: "bell-field-lobby", path: "/fx-harness/bell-field?room=lobby", maxLive: 1 },
  { name: "bell-field-source", path: "/fx-harness/bell-field?room=studio&source=1", maxLive: 1 },
  { name: "emerald-horizon-lobby", path: "/fx-harness/emerald-horizon?room=lobby", maxLive: 1 },
  { name: "emerald-horizon-studio", path: "/fx-harness/emerald-horizon?room=studio", maxLive: 1 },
  { name: "emerald-horizon-source", path: "/fx-harness/emerald-horizon?room=lobby&source=1", maxLive: 1 },
  { name: "dock-retro-workshop", path: "/fx-harness/dock-retro?room=workshop", maxLive: 1 },
  { name: "dock-retro-source", path: "/fx-harness/dock-retro?room=workshop&source=1", maxLive: 1 },
  { name: "dock-glass-studio", path: "/fx-harness/dock-glass?room=studio", maxLive: 1 },
  { name: "dock-glass-source", path: "/fx-harness/dock-glass?room=studio&source=1", maxLive: 1 },
  { name: "portal-field-studio", path: "/fx-harness/portal-field?room=studio", maxLive: 1 },
  { name: "glyph-vortex-studio", path: "/fx-harness/glyph-vortex?room=studio", maxLive: 1 },
  { name: "hzy-orb-lobby", path: "/fx-harness/hzy-orb?room=lobby", maxLive: 0, canvas2d: true },
  { name: "hzy-orb-notebook", path: "/fx-harness/hzy-orb?room=notebook", maxLive: 0, canvas2d: true },
  { name: "hzy-orb-source", path: "/fx-harness/hzy-orb?room=lobby&source=1", maxLive: 0, canvas2d: true },
  { name: "glyph-ball-lobby", path: "/fx-harness/glyph-ball?room=lobby", maxLive: 0, canvas2d: true },
  { name: "glyph-ball-source", path: "/fx-harness/glyph-ball?room=lobby&source=1", maxLive: 0, canvas2d: true },
  { name: "generative-tree-lobby", path: "/fx-harness/generative-tree?room=lobby", maxLive: 0, canvas2d: true },
  { name: "generative-tree-source", path: "/fx-harness/generative-tree?room=lobby&source=1", maxLive: 0, canvas2d: true },
  { name: "outline-typeflow-lobby", path: "/fx-harness/outline-typeflow?room=lobby", maxLive: 0, canvas2d: true },
  { name: "outline-typeflow-notebook", path: "/fx-harness/outline-typeflow?room=notebook", maxLive: 0, canvas2d: true },
  { name: "dot-matrix-workshop", path: "/fx-harness/dot-matrix?room=workshop", maxLive: 1 },
  { name: "dot-matrix-source", path: "/fx-harness/dot-matrix?room=workshop&source=1", maxLive: 1 },
  { name: "crt-boot-workshop", path: "/fx-harness/crt-boot?room=workshop", maxLive: 1 },
  { name: "condensation-workshop", path: "/fx-harness/condensation?room=workshop", maxLive: 0, canvas2d: true },
  { name: "ignition-workshop", path: "/fx-harness/ignition?room=workshop", maxLive: 0, canvas2d: true },
  { name: "trace-border-workshop", path: "/fx-harness/trace-border?room=workshop", maxLive: 0, canvas2d: true },
  { name: "constellation-field-workshop", path: "/fx-harness/constellation-field?room=workshop", maxLive: 0, canvas2d: true },
  { name: "warp-field-workshop", path: "/fx-harness/warp-field?room=workshop", maxLive: 1 },
  { name: "warp-field-source", path: "/fx-harness/warp-field?room=workshop&source=1", maxLive: 1 },
  { name: "logic-core-workshop", path: "/fx-harness/logic-core?room=workshop", maxLive: 1 },
  { name: "logic-core-source", path: "/fx-harness/logic-core?room=workshop&source=1", maxLive: 1 },
];

/** Per-route live WebGL budget from the plan, for the real room routes */
const ROOM_ROUTES = [
  { path: "/colophon", variant: "sable", current: "/", maxLive: 2 },
  { path: "/work", variant: "retro", current: "/work", maxLive: 4 },
  { path: "/music", variant: "glass", current: "/music", maxLive: 4 },
  { path: "/notebook", variant: "modern", current: "/notebook", maxLive: 2 },
  { path: "/wall", variant: "modern", current: "/wall", maxLive: 2 },
];
const MAX_LIVE = Object.fromEntries(ROOM_ROUTES.map((r) => [r.path, r.maxLive]));

/** Records every portal state the host passes through, whether its effect went live, and pushState calls */
const PORTAL_LOG = () => {
  window.__portal = { log: [], live: false, pushes: 0, added: [], strayFocus: 0 };
  const push = history.pushState;
  history.pushState = function (...args) {
    window.__portal.pushes++;
    return push.apply(this, args);
  };
  const watch = () => {
    const el = document.querySelector("[data-portal-state]");
    if (!el) return requestAnimationFrame(watch);
    let last = null;
    const record = (s) => {
      if (el.dataset.portalLive) window.__portal.live = true;
      if (s !== last) window.__portal.log.push(s === "revealing" ? `revealing@${location.pathname}` : s);
      if (s !== last && s === "revealing") window.__portal.loadingAtReveal = !!document.querySelector("[data-room-loading]");
      if (s !== last && s === "holding") {
        // Snapshot what the cover hides: everything but the host (and the player) should be inert
        const kids = [...document.body.children].filter((k) => k instanceof HTMLElement && !k.matches("[data-portal-state], [data-portal-keep], next-route-announcer, script"));
        window.__portal.holding = {
          allInert: kids.length > 0 && kids.every((k) => k.inert),
          focusInHost: el.contains(document.activeElement),
        };
      }
      last = s;
    };
    record(el.dataset.portalState);
    // States can change twice before the observer runs (idle, then a queued trip's covering),
    // so rebuild each one from the records: a record's new value is the next one's old value
    new MutationObserver((records) => {
      const states = records.filter((r) => r.attributeName === "data-portal-state");
      states.forEach((r, i) => record(i + 1 < states.length ? states[i + 1].oldValue : el.dataset.portalState));
      if (!states.length) record(el.dataset.portalState);
    }).observe(el, { attributes: true, attributeOldValue: true });
    // Nodes the incoming route adds under the cover must be inert by the next frame (before
    // it paints), and focus must stay in the portal or the player throughout the trip
    const keep = "[data-portal-state], [data-portal-keep], next-route-announcer, script";
    new MutationObserver((records) => {
      if (el.dataset.portalState === "idle") return;
      const added = records.flatMap((r) => [...r.addedNodes]).filter((n) => n instanceof HTMLElement && !n.matches(keep));
      if (!added.length) return;
      requestAnimationFrame(() => {
        if (el.dataset.portalState === "idle") return;
        added.forEach((n) => window.__portal.added.push(n.isConnected ? n.inert : true));
        const f = document.activeElement;
        if (!(f && (el.contains(f) || f.closest("[data-portal-keep]")))) window.__portal.strayFocus++;
      });
    }).observe(document.body, { childList: true });
  };
  watch();
};

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

// A navigation that times out names the requests the page was still waiting on
{
  const probe = await browser.newPage();
  const proto = Object.getPrototypeOf(probe);
  await probe.close();
  const goto = proto.goto;
  proto.goto = async function (url, opts) {
    const pending = new Map();
    const start = Date.now();
    const add = (r) => pending.set(r, Date.now() - start);
    const done = (r) => pending.delete(r);
    this.on("request", add);
    this.on("requestfinished", done);
    this.on("requestfailed", done);
    try {
      return await goto.call(this, url, opts);
    } catch (e) {
      const list = [...pending].map(([r, at]) => `${r.method()} ${r.url()} (sent +${at}ms)`);
      e.message += `\nstill pending: ${JSON.stringify(list, null, 2)}`;
      throw e;
    } finally {
      this.off("request", add);
      this.off("requestfinished", done);
      this.off("requestfailed", done);
    }
  };
}

// ── HZY reveal easing: one shared curve, continuous, and the bloom's inverse matches it ──
{
  const mod = await import(new URL("../components/nav/hzyMarkPath.ts", import.meta.url).href).catch(() => ({}));
  const { hzyRevealEase: ease, hzyRevealAt: at } = mod;
  const shared = typeof ease === "function" && typeof at === "function";
  let jump = Infinity;
  let monotonic = false;
  let roundTrip = Infinity;
  if (shared) {
    jump = Math.abs(ease(0.5 - 1e-6) - ease(0.5 + 1e-6));
    monotonic = Array.from({ length: 200 }, (_, i) => ease((i + 1) / 200) >= ease(i / 200)).every(Boolean);
    roundTrip = Math.max(...Array.from({ length: 101 }, (_, i) => Math.abs(at(ease(i / 100)) - i / 100)));
  }
  check("hzy-ease", "mark and bloom share one continuous, invertible reveal curve", shared && jump < 1e-3 && monotonic && roundTrip < 1e-6, { shared, jump, monotonic, roundTrip });
}

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
  await context.addInitScript(FADE_PROBE);
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
  const fade = await page.evaluate(() => window.__fade);
  check(route.name, "canvases hidden until live, then fade in", fade.preLiveMax < 0.05 && fade.firstLive !== null && fade.firstLive < 0.9, fade);
  const churn = await page.evaluate(() => ({ attempts: window.__fx.attempts(), acquisitions: window.__fx.acquisitions() }));
  // 2D effects never take a WebGL lease
  check(route.name, "single creation, no remount churn", churn.attempts === 1 && churn.acquisitions === (route.canvas2d ? 0 : 1), churn);

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

// ── Budget: stages denied a slot wait, then go live when slots free ─────────────
{
  const context = await browser.newContext({ ...CONTEXT_OPTS, viewport: { width: 1440, height: 900 } });
  await context.addInitScript(COUNT_CONTEXTS);
  const page = await context.newPage();
  await page.goto(BASE + "/fx-harness/bell-field?room=studio&count=8", { waitUntil: "networkidle" });
  await page.waitForTimeout(4000);
  const states = () => page.evaluate(() => [...document.querySelectorAll("[data-fx]")].map((h) => h.dataset.fxState));
  const before = await states();
  const leasesBefore = await page.evaluate(() => window.__fx.live());
  check("budget", "6 leases, 2 stages waiting on posters", leasesBefore === 6 && before.filter((s) => s === "poster").length === 2, { leasesBefore, before });
  await page.click('[data-testid="remove-two"]');
  await page.waitForTimeout(4000);
  const after = await states();
  const gl = await page.evaluate(() => window.__gl());
  check("budget", "waiting stages go live once slots free", after.length === 6 && after.every((s) => s === "live"), { after });
  check("budget", "no leaked contexts after removal", gl.live === 6, gl);
  await context.close();
}

// ── Budget: on-screen waiters reclaim slots from holders that went offscreen ────
{
  const context = await browser.newContext({ ...CONTEXT_OPTS, viewport: { width: 1440, height: 900 } });
  await context.addInitScript(COUNT_CONTEXTS);
  const page = await context.newPage();
  // The first six stages mount (and lease) first but sit 300vh below; the last two are on screen
  await page.goto(BASE + "/fx-harness/bell-field?room=studio&count=8&layout=below", { waitUntil: "networkidle" });
  await page.waitForTimeout(4000);
  const onScreen = await page.evaluate(() =>
    [...document.querySelectorAll("[data-fx]")].slice(-2).map((h) => h.dataset.fxState)
  );
  const gl = await page.evaluate(() => window.__gl());
  check("budget-below", "on-screen stages evict offscreen holders and go live", onScreen.every((s) => s === "live"), { onScreen });
  check("budget-below", "live contexts stay within budget", gl.live <= 6, gl);
  await context.close();
}

// ── Context loss: one recovery, no double remount ──────────────────────────────
{
  const context = await browser.newContext({ ...CONTEXT_OPTS, viewport: { width: 1280, height: 800 } });
  await context.addInitScript(COUNT_CONTEXTS);
  const page = await context.newPage();
  await page.goto(BASE + "/fx-harness/bell-field?room=studio", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-fx-state="live"]', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const canvas = document.querySelector("[data-fx] canvas");
    const ext = canvas?.getContext("webgl")?.getExtension("WEBGL_lose_context");
    ext?.loseContext();
    setTimeout(() => ext?.restoreContext(), 300);
  });
  await page.waitForTimeout(3000);
  const after = await page.evaluate(() => ({
    state: document.querySelector("[data-fx]")?.dataset.fxState,
    attempts: window.__fx.attempts(),
    leases: window.__fx.live(),
    gl: window.__gl(),
  }));
  check("context-loss", "recovers live with exactly one extra attempt", after.state === "live" && after.attempts === 2, after);
  check("context-loss", "one live context afterwards", after.gl.live === 1 && after.leases === 1, after.gl);
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

// ── Audio: CORS refusal falls back to a plain element and never shows "playing" while silent ──
{
  // No autoplay flag here: the fallback's play() runs outside the click, as in a real browser
  const strict = await chromium.launch({ headless: true, args: LAUNCH_ARGS.filter((a) => !a.startsWith("--autoplay")) });
  const mp3 = fs.readFileSync(path.resolve("public/fx-test/kick.mp3"));
  const SRC = "https://fx-cors-test.supabase.co/kick.mp3"; // allowed by media-src; served by the route below
  const context = await strict.newContext({ ...CONTEXT_OPTS, viewport: { width: 1280, height: 800 } });
  // Playwright adds a permissive ACAO to fulfilled responses unless one is set, so name a
  // different origin: the crossOrigin element must then be refused, like a host without CORS
  await context.route(SRC, (r) =>
    r.fulfill({
      status: 200,
      contentType: "audio/mpeg",
      headers: { "access-control-allow-origin": "https://not-this-site.example" },
      body: mp3,
    })
  );
  const page = await context.newPage();
  await page.goto(BASE + "/fx-harness/bell-field?room=studio&audio=1&audioSrc=" + encodeURIComponent(SRC), { waitUntil: "networkidle" });
  await page.click('[data-testid="play-fixture"]');
  await page.waitForTimeout(2500);
  let audio = await page.evaluate(() => window.__fx.audio());
  const label = () => page.getAttribute('button[aria-label="Pause"], button[aria-label="Play"]', "aria-label");
  let shown = await label();
  check("audio-cors", "fallback engaged, analyser off", audio.corsBroken && !audio.analyser, audio);
  check("audio-cors", "player never shows Pause while paused", !(shown === "Pause" && audio.paused), { shown, paused: audio.paused });
  if (audio.paused) {
    await page.click('button[aria-label="Play"]');
    await page.waitForTimeout(1500);
    audio = await page.evaluate(() => window.__fx.audio());
    shown = await label();
  }
  check("audio-cors", "fallback element plays (after at most one more click)", !audio.paused && audio.currentTime > 0.3 && shown === "Pause", { ...audio, shown });
  await context.close();
  await strict.close();
}

// ── Transition effects mid-trip, for review (cover, hold, reveal) ──────────────────
for (const effect of ["portal-field", "glyph-vortex"]) {
  const context = await browser.newContext({ ...CONTEXT_OPTS, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(BASE + `/fx-harness/${effect}?room=lobby&demo=studio`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-fx-state="live"]', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await page.click('[data-testid="demo"]');
  for (const [label, at] of [["cover", 300], ["hold", 820], ["reveal", 1330]]) {
    await page.waitForTimeout(at - (label === "cover" ? 0 : label === "hold" ? 300 : 820));
    await page.screenshot({ path: path.join(OUT, `${effect}-${label}.png`) });
  }
  await context.close();
}

// ── Chrome: one dock per room, right variant, current room marked, within budget ──
const chromePage = async (opts = {}) => {
  const context = await browser.newContext({ ...CONTEXT_OPTS, viewport: { width: 1440, height: 900 }, ...opts });
  await context.addInitScript(COUNT_CONTEXTS);
  await context.addInitScript(PORTAL_LOG);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (/too many active webgl contexts/i.test(m.text())) errors.push(m.text());
  });
  return { context, page, errors };
};

const portalIdleAt = (page, pathname, timeout = 12000) =>
  page
    .waitForFunction(
      (p) => location.pathname === p && document.querySelector("[data-portal-state]")?.dataset.portalState === "idle",
      pathname,
      { timeout }
    )
    .then(() => true)
    .catch(() => false);

for (const route of ROOM_ROUTES) {
  const { context, page, errors } = await chromePage();
  await page.goto(BASE + route.path, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const dock = await page.evaluate(() => {
    const docks = [...document.querySelectorAll(".dock")];
    const current = docks[0]?.querySelector('[aria-current="page"]');
    return {
      count: docks.length,
      variant: docks[0]?.dataset.dockVariant,
      current: current?.getAttribute("href") ?? null,
      field: docks[0]?.querySelector("[data-fx]")?.dataset.fxState ?? null,
    };
  });
  const gl = await page.evaluate(() => window.__gl());
  const tag = `dock ${route.path}`;
  check(tag, `one ${route.variant} dock, current room marked`, dock.count === 1 && dock.variant === route.variant && dock.current === route.current, dock);
  if (route.variant === "retro" || route.variant === "glass") check(tag, "dock field live", dock.field === "live", dock);
  check(tag, `live webgl contexts <= ${route.maxLive}`, gl.live <= route.maxLive, gl);
  check(tag, "no page errors", errors.length === 0, errors.slice(0, 3));
  await page.screenshot({ path: path.join(OUT, `room${route.path.replace("/", "-")}-desktop.png`) });
  await context.close();
}

for (const route of ROOM_ROUTES) {
  const { context, page } = await chromePage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.goto(BASE + route.path, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const fits = await page.evaluate(() => {
    const r = document.querySelector(".dock")?.getBoundingClientRect();
    return { left: r?.left, right: r?.right, width: innerWidth, scrollX: document.documentElement.scrollWidth };
  });
  check(`dock ${route.path} 390px`, "dock fits the viewport, no horizontal scroll", fits.left >= 0 && fits.right <= fits.width && fits.scrollX <= fits.width, fits);
  await page.screenshot({ path: path.join(OUT, `room${route.path.replace("/", "-")}-mobile.png`) });
  await context.close();
}

// ── Chrome: rooms switched off in settings leave the dock ─────────────────────────
{
  const { context, page } = await chromePage();
  await page.goto(BASE + "/fx-harness/dock?room=lobby&hide=wall", { waitUntil: "networkidle" });
  const links = await page.evaluate(() => [...document.querySelectorAll(".dock a")].map((a) => a.getAttribute("href")));
  check("dock-visibility", "hidden room dropped, others kept", !links.includes("/wall") && links.includes("/work") && links.includes("/music"), { links });
  await context.close();
}

// ── Chrome: proximity magnification grows the hovered item and settles back ──────
{
  const { context, page } = await chromePage();
  await page.goto(BASE + "/colophon", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const item = page.locator('.dock a[href="/music"]');
  const base = await item.boundingBox();
  await page.mouse.move(base.x + base.width / 2, base.y + base.height / 2, { steps: 4 });
  await page.waitForTimeout(500);
  const grown = await item.boundingBox();
  const state = await page.getAttribute(".dock-sable", "data-dock-state");
  await page.mouse.move(base.x + base.width / 2, 600, { steps: 4 });
  await page.waitForTimeout(800);
  const settled = await item.boundingBox();
  check("dock-magnify", "hovered item grows", grown.width > base.width + 8 && grown.height > base.height + 8 && state === "active", { base, grown, state });
  check("dock-magnify", "settles back after the pointer leaves", Math.abs(settled.width - base.width) < 1, { settled });
  await context.close();
}

// ── Primitives: names, keyboard parity, reduced motion ──────────────────────────
{
  const { context, page, errors } = await chromePage();
  await page.goto(BASE + "/fx-harness/primitives?room=lobby", { waitUntil: "networkidle" });
  const names = await page.evaluate(() => {
    const ctas = [...document.querySelectorAll(".cta")].map((el) => ({ tag: el.tagName, name: el.textContent.trim() }));
    return { ctas };
  });
  const byName = async (role, name) => page.getByRole(role, { name, exact: true }).count();
  const slideOnce = await byName("button", "see the work");
  const beamOnce = await byName("button", "start here");
  const mail = await page.getByRole("link", { name: "say hello", exact: true }).evaluate((a) => a.tagName === "A" && a.getAttribute("href").startsWith("mailto:"));
  const play = await byName("button", "play");
  const pressed = await page.getByRole("button", { name: "loop on", exact: true }).getAttribute("aria-pressed");
  const disabled = await page.getByRole("button", { name: "disabled", exact: true }).isDisabled();
  check("primitives", "each control is named once by its label", slideOnce === 1 && beamOnce === 1 && play === 1, { slideOnce, beamOnce, play });
  check("primitives", "links are anchors, actions are buttons", mail && names.ctas.filter((c) => c.tag === "A").length === 1, { mail });
  check("primitives", "toggle and disabled state exposed", pressed === "true" && disabled, { pressed, disabled });

  // Keyboard focus shows the same state hover does (fresh page: programmatic focus is :focus-visible)
  const lineLeft = () => page.evaluate(() => getComputedStyle(document.querySelector(".cta--trace .cta__line--left")).transform);
  const beforeFocus = await lineLeft();
  await page.getByRole("link", { name: "say hello", exact: true }).focus();
  // The left edge draws last (about 1.2s in); a CPU renderer can run behind that
  await page
    .waitForFunction(() => /^(none|matrix\(1, 0, 0, 1, 0, 0\))$/.test(getComputedStyle(document.querySelector(".cta--trace .cta__line--left")).transform), null, { timeout: 5000 })
    .catch(() => {});
  const afterFocus = await lineLeft();
  await page.getByRole("button", { name: "request a demo", exact: true }).focus();
  await page
    .waitForFunction(() => getComputedStyle(document.querySelector(".cta--spin .cta__beam")).opacity === "1", null, { timeout: 3000 })
    .catch(() => {});
  const spinBeam = await page.evaluate(() => getComputedStyle(document.querySelector(".cta--spin .cta__beam")).opacity);
  check("primitives", "focus draws the trace edges like hover", beforeFocus !== afterFocus && /^(none|matrix\(1, 0, 0, 1, 0, 0\))$/.test(afterFocus), { beforeFocus, afterFocus });
  check("primitives", "focus lights the spin beam like hover", spinBeam === "1", { spinBeam });
  check("primitives", "no page errors", errors.length === 0, errors.slice(0, 3));
  await page.screenshot({ path: path.join(OUT, "primitives-lobby.png"), fullPage: true });
  await context.close();
}

{
  const { context, page } = await chromePage({ reducedMotion: "reduce" });
  await page.goto(BASE + "/fx-harness/primitives?room=studio", { waitUntil: "networkidle" });
  const anim = await page.evaluate(() =>
    [".cta--beam .cta__beam", ".cta--beam .cta__dots", ".cta--spin .cta__beam", ".cbtn--glass .cbtn__aura"].map(
      (sel) => getComputedStyle(document.querySelector(sel)).animationName
    )
  );
  check("primitives-reduced", "nothing loops under reduced motion", anim.every((a) => a === "none"), { anim });
  await context.close();
}

// ── Decode: scrambles the visible layer only, settles exactly, never shifts layout ─
const sampleDecode = (page, selector, ms) =>
  page.evaluate(
    ([sel, duration]) =>
      new Promise((resolve) => {
        const host = document.querySelector(sel);
        const live = host.querySelector("[data-decode-live]");
        const sr = host.querySelector(".sr-only");
        const target = host.dataset.decodeText;
        const box = () => {
          const r = host.getBoundingClientRect();
          return `${r.width.toFixed(1)}x${r.height.toFixed(1)}`;
        };
        const firstBox = box();
        let differed = false;
        let srAlways = true;
        let boxSteady = true;
        const start = performance.now();
        const step = (now) => {
          if (live.textContent !== target) differed = true;
          if (sr.textContent !== target) srAlways = false;
          if (box() !== firstBox) boxSteady = false;
          if (now - start < duration) requestAnimationFrame(step);
          else resolve({ differed, srAlways, boxSteady, settled: live.textContent === target, target });
        };
        requestAnimationFrame(step);
      }),
    [selector, ms]
  );

{
  const { context, page } = await chromePage();
  // No orbs: a CPU renderer drawing fifteen of them would land the 560ms decode in a frame or two
  await page.goto(BASE + "/fx-harness/primitives?room=lobby&orbs=0&decodeDelay=1500", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#decode-lobby [data-decode-live]");
  const run = await sampleDecode(page, "#decode-lobby", 6000);
  const heading = await page.getByRole("heading", { name: "the lobby", exact: true }).count();
  check("decode", "scrambles, then settles on the exact text", run.differed && run.settled, run);
  check("decode", "assistive copy never scrambles; box never shifts", run.srAlways && run.boxSteady, run);
  check("decode", "heading is found by role and name", heading === 1, { heading });
  await context.close();
}

{
  const { context, page } = await chromePage();
  await page.goto(BASE + "/fx-harness/primitives?orbs=0", { waitUntil: "networkidle" });
  const sel = '[data-testid="prim-wall"] p.decode';
  const untouched = await sampleDecode(page, sel, 600);
  // It sits at the very end of the page, which can't scroll it past the bottom edge
  await page.evaluate((s) => document.querySelector(s).scrollIntoView({ block: "center" }), sel);
  const scrolled = await sampleDecode(page, sel, 1500);
  check("decode-visible", "waits offscreen, decodes once scrolled into view", !untouched.differed && scrolled.differed && scrolled.settled, { untouched, scrolled });
  await context.close();
}

{
  const { context, page } = await chromePage({ reducedMotion: "reduce" });
  await page.goto(BASE + "/fx-harness/primitives?room=lobby&orbs=0&decodeDelay=1000", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#decode-lobby [data-decode-live]");
  const run = await sampleDecode(page, "#decode-lobby", 4000);
  check("decode-reduced", "reduced motion shows the final text throughout", !run.differed && run.settled, run);
  await context.close();
}

// ── HzyOrb: 2D on the shared ticker, no WebGL, pauses offscreen ───────────────────
{
  const { context, page, errors } = await chromePage();
  await page.goto(BASE + "/fx-harness/primitives", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="prim-lobby"] [data-fx="hzy-orb"][data-fx-state="live"]', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const orbs = await page.evaluate(() => ({
    lobbyLive: document.querySelectorAll('[data-testid="prim-lobby"] [data-fx="hzy-orb"][data-fx-state="live"]').length,
    gl: window.__gl().live,
  }));
  const f0 = await stageFrames(page);
  await page.waitForTimeout(800);
  const f1 = await stageFrames(page);
  check("hzy-orb", "three orbs live with no WebGL context", orbs.lobbyLive === 3 && orbs.gl === 0, orbs);
  check("hzy-orb", "orbs animate", f1 > f0, { f0, f1 });

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(800);
  const lobbyIds = await page.evaluate(() => {
    const s = window.__fx.stats().stages;
    return s.filter((x) => !x.active).map((x) => x.id);
  });
  const frozenA = await page.evaluate((ids) => window.__fx.stats().stages.filter((x) => ids.includes(x.id)).reduce((n, x) => n + x.frames, 0), lobbyIds);
  await page.waitForTimeout(800);
  const frozenB = await page.evaluate((ids) => window.__fx.stats().stages.filter((x) => ids.includes(x.id)).reduce((n, x) => n + x.frames, 0), lobbyIds);
  check("hzy-orb", "offscreen orbs stop drawing", lobbyIds.length >= 3 && frozenA === frozenB, { offscreen: lobbyIds.length, frozenA, frozenB });
  check("hzy-orb", "no page errors", errors.length === 0, errors.slice(0, 3));
  await context.close();
}

// ── HzyOrb: a pulse sent before the orb is live still plays once it is ───────────
{
  const { context, page, errors } = await chromePage();
  await page.goto(BASE + "/fx-harness/hzy-orb?room=lobby&pulse=1", { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-fx="hzy-orb"][data-fx-state="live"]', { timeout: 20000 }).catch(() => {});
  const started = await page
    .waitForSelector('[data-fx="hzy-orb"] canvas[data-pulsing]', { timeout: 3000 })
    .then(() => true)
    .catch(() => false);
  const ended = started
    ? await page
        .waitForSelector('[data-fx="hzy-orb"] canvas[data-pulsing]', { state: "detached", timeout: 4000 })
        .then(() => true)
        .catch(() => false)
    : false;
  check("hzy-orb-pulse", "a pulse queued before live plays, then ends", started && ended, { started, ended });
  check("hzy-orb-pulse", "no page errors", errors.length === 0, errors.slice(0, 3));
  await context.close();
}

// ── Workshop: the IDE bar lives in the layout, crumbs follow the URL, field persists ─
{
  const { context, page } = await chromePage();
  await page.goto(BASE + "/work/no-such-project", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const deep = await page.evaluate(() => ({
    docks: document.querySelectorAll(".dock-retro").length,
    crumbs: [...document.querySelectorAll(".dock-retro-crumb")].map((c) => c.textContent),
    acquisitions: window.__fx.acquisitions(),
  }));
  await page.click(".dock-retro-path a");
  await page.waitForFunction(() => location.pathname === "/work", null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const top = await page.evaluate(() => ({
    docks: document.querySelectorAll(".dock-retro").length,
    crumbs: document.querySelectorAll(".dock-retro-crumb").length,
    acquisitions: window.__fx.acquisitions(),
    field: document.querySelector(".dock-retro [data-fx]")?.dataset.fxState,
  }));
  check("workshop-bar", "one bar with crumbs from the URL", deep.docks === 1 && deep.crumbs.join() === "/no-such-project" && top.docks === 1 && top.crumbs === 0, { deep, top });
  check("workshop-bar", "dock field survives moving between workshop pages", top.acquisitions === deep.acquisitions && top.field === "live", { deep, top });
  await context.close();
}

{
  // An encoded slug shows decoded in the crumbs and never takes the layout (and its dock) down.
  // (A lone %, as in /work/100%25, fails in Next's own param decoding before any app code runs.)
  const { context, page, errors } = await chromePage();
  await page.goto(BASE + "/work/a%20b", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const bar = await page.evaluate(() => ({
    docks: document.querySelectorAll(".dock-retro").length,
    crumbs: [...document.querySelectorAll(".dock-retro-crumb")].map((c) => c.textContent),
  }));
  check("workshop-bar", "encoded slug crumbs decode, no errors", bar.docks === 1 && bar.crumbs.join() === "/a b" && errors.length === 0, { bar, errors: errors.slice(0, 2) });
  await context.close();
}

// ── Room loading: slow content reveals onto the loading state, then focus follows ─
{
  const { context, page, errors } = await chromePage();
  // Hold the /work navigation's RSC payload (not its prefetches) so the loading boundary shows
  await page.route(/\/work(\?|$)/, async (route) => {
    const h = route.request().headers();
    const navigation = h.rsc === "1" && !h["next-router-prefetch"] && !h["next-router-segment-prefetch"];
    if (navigation) await new Promise((r) => setTimeout(r, 3500));
    await route.continue();
  });
  await page.goto(BASE + "/colophon", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const el = document.querySelector("[data-portal-state]");
    const mo = new MutationObserver(() => {
      if (el.dataset.portalState !== "revealing") return;
      mo.disconnect();
      window.__loadingAtReveal = document.querySelector("[data-room-loading]")?.dataset.roomLoading ?? null;
    });
    mo.observe(el, { attributes: true, attributeFilter: ["data-portal-state"] });
  });
  await page.click('.dock a[href="/work"]');
  const idle = await portalIdleAt(page, "/work", 8000);
  const during = await page.evaluate(() => ({
    atReveal: window.__loadingAtReveal,
    loading: !!document.querySelector("[data-room-loading]"),
    status: document.querySelector("[data-room-loading]")?.getAttribute("role"),
    lit: document.querySelectorAll("[data-room-loading] .uplink__tick.is-on").length,
  }));
  await page.screenshot({ path: path.join(OUT, "room-loading-workshop.png") });
  await page.waitForFunction(() => !document.querySelector("[data-room-loading]"), null, { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => ({
    focused: document.activeElement?.tagName === "H1" ? document.activeElement.textContent : document.activeElement?.tagName,
  }));
  check("room-loading", "slow room reveals onto its loading state", idle && during.atReveal === "workshop" && during.loading && during.status === "status", during);
  check("room-loading", "the workshop's uplink bar lights while it waits", during.lit > 0, during);
  check("room-loading", "heading takes focus once the content lands", after.focused === "workshop", after);
  check("room-loading", "no page errors", errors.length === 0, errors.slice(0, 3));
  await context.close();
}

// ── Portal: one trip walks every state, pushes once, focuses the new room ────────
{
  const { context, page, errors } = await chromePage();
  await page.goto(BASE + "/colophon", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.hover('.dock a[href="/work"]');
  await page.waitForTimeout(300);
  const t0 = Date.now();
  await page.click('.dock a[href="/work"]');
  await page.waitForSelector('[data-portal-state="holding"]', { timeout: 5000 }).catch(() => {});
  await page.screenshot({ path: path.join(OUT, "portal-field-holding.png") });
  const arrived = await portalIdleAt(page, "/work");
  const ms = Date.now() - t0;
  const portal = await page.evaluate(() => ({
    ...window.__portal,
    focused: document.activeElement?.tagName === "H1" ? document.activeElement.textContent : document.activeElement?.tagName,
  }));
  const walk = portal.log.join(">");
  check("portal", "arrives at /work and returns to idle", arrived, { ms });
  check("portal", "walks covering > holding > revealing > idle", /covering>holding>revealing@\/work>idle$/.test(walk), { walk });
  check("portal", "page is inert under the cover and focus sits in the portal", portal.holding?.allInert && portal.holding?.focusInHost, portal.holding);
  check("portal", "incoming route is inert before it paints, focus never strays", portal.added.every(Boolean) && portal.strayFocus === 0, { added: portal.added, strayFocus: portal.strayFocus });
  const inertAfter = await page.evaluate(() => [...document.body.children].some((k) => k.inert));
  check("portal", "nothing left inert after the trip", !inertAfter);
  check("portal", "effect went live during the trip", portal.live, portal);
  check("portal", "exactly one history push", portal.pushes === 1, { pushes: portal.pushes });
  check("portal", "new room's heading takes focus", portal.focused === "workshop", { focused: portal.focused });
  check("portal", "a quick room reveals straight onto its content", portal.loadingAtReveal === false, { loadingAtReveal: portal.loadingAtReveal });
  check("portal", "no page errors", errors.length === 0, errors.slice(0, 3));

  const before = portal.log.length;
  await page.goBack();
  await page.waitForFunction(() => location.pathname === "/colophon", null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1200);
  const back = await page.evaluate((n) => window.__portal.log.slice(n), before);
  check("portal", "back/forward never covers", !back.includes("covering"), { back });
  await context.close();
}

// ── Portal: re-targeting mid-trip (fired from a mutation observer, so timing is exact) ─────
for (const [when, expect] of [
  ["holding", /covering>holding>revealing@\/music>idle$/],
  ["revealing", /covering>holding>revealing@\/work>idle>covering>holding>revealing@\/music>idle$/],
]) {
  const { context, page, errors } = await chromePage();
  await page.goto(BASE + "/colophon", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.evaluate((phase) => {
    const el = document.querySelector("[data-portal-state]");
    const mo = new MutationObserver(() => {
      if (el.dataset.portalState !== phase) return;
      mo.disconnect();
      window.__fxPortal.go("/music");
    });
    mo.observe(el, { attributes: true, attributeFilter: ["data-portal-state"] });
  }, when);
  await page.click('.dock a[href="/work"]');
  const arrived = await portalIdleAt(page, "/music", 20000);
  await page.waitForTimeout(400);
  const portal = await page.evaluate(() => ({ ...window.__portal, path: location.pathname }));
  const walk = portal.log.join(">");
  check(`portal-retarget-${when}`, "lands on the second room, revealing only there", arrived && expect.test(walk), { walk, path: portal.path });
  check(`portal-retarget-${when}`, "no page errors", errors.length === 0, errors.slice(0, 3));
  await context.close();
}

// ── Portal: same-room links skip it ───────────────────────────────────────────────
{
  const { context, page } = await chromePage();
  await page.goto(BASE + "/work", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.click(".dock-retro-path a");
  await page.waitForTimeout(1200);
  const log = await page.evaluate(() => window.__portal.log);
  check("portal-same-room", "workshop crumb link doesn't cover", !log.includes("covering"), { log });
  await context.close();
}

// ── Budget: three laps through four rooms via the dock ───────────────────────────
{
  const { context, page, errors } = await chromePage();
  await page.goto(BASE + "/work", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const hops = [];
  for (let lap = 0; lap < 3; lap++) {
    for (const href of ["/music", "/notebook", "/wall", "/work"]) {
      await page.click(`.dock a[href="${href}"]`);
      const ok = await portalIdleAt(page, href);
      await page.waitForTimeout(600);
      const gl = await page.evaluate(() => window.__gl());
      const leases = await page.evaluate(() => window.__fx.live());
      hops.push({ href, ok, live: gl.live, leases, created: gl.created });
    }
  }
  const over = hops.filter((h) => !h.ok || h.live > MAX_LIVE[h.href] || h.leases !== h.live);
  check("laps", "12 hops arrive, contexts within each room's budget", over.length === 0, over.length ? over : { last: hops.at(-1) });
  check("laps", "no context warnings or page errors", errors.length === 0, errors.slice(0, 3));
  results.push({ route: "laps", hops });
  await context.close();
}

// ── Portal: reduced motion navigates instantly, no cover ─────────────────────────
{
  const { context, page } = await chromePage({ reducedMotion: "reduce" });
  await page.goto(BASE + "/colophon", { waitUntil: "networkidle" });
  await page.click('.dock a[href="/work"]');
  await page.waitForFunction(() => location.pathname === "/work", null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1000);
  const portal = await page.evaluate(() => ({ ...window.__portal, stages: document.querySelectorAll("[data-portal-state] [data-fx]").length }));
  check("portal-reduced", "no cover and no transition effect", !portal.log.includes("covering") && portal.stages === 0, portal);
  await context.close();
}

// ── Lobby: one persistent horizon behind the splash, honest counter, bloom, rise ──
const LOBBY_LOG = () => {
  window.__lobby = { at100: null, bloomSeen: false, bloomDuringGreeting: false, phases: [] };
  const tick = () => {
    const splash = document.querySelector("[data-splash-phase]");
    const phase = splash?.dataset.splashPhase ?? null;
    if (phase && window.__lobby.phases.at(-1) !== phase) window.__lobby.phases.push(phase);
    const counter = splash?.querySelector("span.font-mono");
    if (window.__lobby.at100 === null && counter?.textContent === "100")
      window.__lobby.at100 = document.querySelector("[data-lobby-backdrop] [data-fx]")?.dataset.fxState ?? "missing";
    if (document.querySelector("[data-splash-bloom]")) {
      window.__lobby.bloomSeen = true;
      if (phase === "greeting" || phase === "typewriter") window.__lobby.bloomDuringGreeting = true;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

const backdropFrames = (page) =>
  page.evaluate(() => {
    const stages = window.__fx?.stats().stages ?? [];
    return stages.reduce((n, s) => n + s.frames, 0);
  });

{
  const { context, page, errors } = await chromePage();
  await context.addInitScript(LOBBY_LOG);
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  const one = await page.evaluate(() => document.querySelectorAll('[data-lobby-backdrop] [data-fx="emerald-horizon"]').length);
  // Fonts come through the sandbox proxy here, so the counter can take a while
  await page.waitForSelector('[data-splash-phase="logo"]', { timeout: 40000 }).catch(() => {});
  const underSplash = await page.evaluate(() => ({
    rise: document.querySelector("[data-lobby-backdrop]")?.dataset.rise,
    state: document.querySelector("[data-lobby-backdrop] [data-fx]")?.dataset.fxState,
  }));
  const coveredA = await backdropFrames(page);
  await page.waitForTimeout(800);
  const coveredB = await backdropFrames(page);
  const cta = page.getByRole("button", { name: /let.s go/i });
  await cta.waitFor({ timeout: 20000 }).catch(() => {});
  const lobby = await page.evaluate(() => window.__lobby);
  check("lobby-splash", "one horizon behind the splash, below the frame", one === 1 && underSplash.rise === "0" && underSplash.state === "live", { one, ...underSplash });
  check("lobby-splash", "counter reads 100 only once the horizon is live", lobby.at100 === "live", { at100: lobby.at100 });
  check("lobby-splash", "covered horizon holds its frame", coveredA === coveredB && coveredA > 0, { coveredA, coveredB });
  check("lobby-splash", "the mark forms from particles, gone by the greeting", lobby.bloomSeen && !lobby.bloomDuringGreeting, lobby);

  await page.waitForTimeout(700);
  await cta.click();
  await page.waitForFunction(() => document.querySelector("[data-lobby-backdrop]")?.dataset.rise === "1", null, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(300);
  const lifting = await page.evaluate(() => {
    const s = document.querySelector("[data-splash-phase]");
    return { bg: s ? getComputedStyle(s).backgroundColor : null, rise: document.querySelector("[data-lobby-backdrop]")?.dataset.rise };
  });
  await page.waitForFunction(() => document.querySelector("[data-lobby-backdrop]")?.dataset.lobbyPhase === "sequence", null, { timeout: 6000 }).catch(() => {});
  const risenA = await backdropFrames(page);
  await page.waitForTimeout(800);
  const risenB = await backdropFrames(page);
  const seq = await page.evaluate(() => ({
    footer: getComputedStyle(document.querySelector("[data-site-footer]")).display,
    gl: window.__gl().live,
  }));
  const alpha = (() => {
    const m = /rgba?\(([^)]+)\)/.exec(lifting.bg ?? "");
    const parts = m ? m[1].split(",").map(Number) : [];
    return parts.length === 4 ? parts[3] : lifting.bg === "transparent" ? 0 : 1;
  })();
  check("lobby-splash", "exit lifts the cream off a rising horizon", lifting.rise === "1" && alpha < 1, { ...lifting, alpha });
  check("lobby-splash", "horizon animates once uncovered", risenB > risenA, { risenA, risenB });
  check("lobby-sequence", "footer steps out under the sequence; contexts within budget", seq.footer === "none" && seq.gl <= 2, seq);
  check("lobby-splash", "no page errors", errors.length === 0, errors.slice(0, 3));
  await page.screenshot({ path: path.join(OUT, "lobby-sequence-hero.png") });

  // Leave through the dock and come back: no splash, the horizon starts at rest
  await page.click('.dock a[href="/work"]');
  await portalIdleAt(page, "/work", 15000);
  await page.click('.dock a[href="/"]').catch(() => page.click(".dock [data-hzy-mark-target]"));
  await portalIdleAt(page, "/", 15000);
  await page.waitForTimeout(800);
  const back = await page.evaluate(() => ({
    splash: !!document.querySelector("[data-splash-phase]"),
    phase: document.querySelector("[data-lobby-backdrop]")?.dataset.lobbyPhase,
    rise: document.querySelector("[data-lobby-backdrop]")?.dataset.rise,
    state: document.querySelector("[data-lobby-backdrop] [data-fx]")?.dataset.fxState,
    footer: getComputedStyle(document.querySelector("[data-site-footer]")).display,
  }));
  check("lobby-return", "returning visitor: no splash, horizon at rest, footer back", !back.splash && back.phase === "resting" && back.rise === "1" && back.state === "live" && back.footer !== "none", back);
  await context.close();
}

// The horizon's rise must survive a context loss: a recreated instance starts where it was
{
  const sharp = (await import("sharp")).default;
  const bottomLuma = async (page) => {
    const png = await page.screenshot({ clip: { x: 0, y: 700, width: 1440, height: 200 } });
    const { data } = await sharp(png).greyscale().raw().toBuffer({ resolveWithObject: true });
    return data.reduce((n, v) => n + v, 0) / data.length;
  };
  const { context, page, errors } = await chromePage();
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2300);
  await page.getByText("skip").click().catch(() => {});
  const cta = page.getByRole("button", { name: /let.s go/i });
  await cta.waitFor({ timeout: 40000 }).catch(() => {});
  await page.waitForTimeout(600);
  await cta.click();
  await page.waitForFunction(() => document.querySelector("[data-lobby-backdrop]")?.dataset.lobbyPhase === "sequence", null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(3000);
  const before = await bottomLuma(page);
  const attemptsBefore = await page.evaluate(() => window.__fx.attempts());
  await page.evaluate(() => {
    const canvas = document.querySelector("[data-lobby-backdrop] [data-fx] canvas");
    const ext = canvas?.getContext("webgl")?.getExtension("WEBGL_lose_context");
    ext?.loseContext();
    setTimeout(() => ext?.restoreContext(), 300);
  });
  await page.waitForFunction((n) => window.__fx.attempts() > n && document.querySelector("[data-lobby-backdrop] [data-fx]")?.dataset.fxState === "live", attemptsBefore, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const after = await bottomLuma(page);
  check("lobby-recreate", "a recreated horizon stays risen (bottom of the frame keeps its glow)", after > before * 0.6 && before > 25, { before: +before.toFixed(1), after: +after.toFixed(1) });
  check("lobby-recreate", "no page errors", errors.length === 0, errors.slice(0, 3));
  await context.close();
}

{
  const { context, page } = await chromePage({ reducedMotion: "reduce" });
  await context.addInitScript(LOBBY_LOG);
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /let.s go/i }).waitFor({ timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(600);
  const lobby = await page.evaluate(() => window.__lobby);
  check("lobby-reduced", "reduced motion: straight to the CTA, no particles", !lobby.bloomSeen && !lobby.phases.includes("logo"), lobby);
  await context.close();
}

// ── Splash: the logo lands exactly on the dock's mark ────────────────────────────
{
  const { context, page } = await chromePage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const inertDuring = await page.evaluate(() => document.querySelector(".dock-anchor")?.hasAttribute("inert"));
  await page.waitForTimeout(2300);
  await page.getByText("skip").click().catch(() => {});
  const cta = page.getByRole("button", { name: /let.s go/i });
  await cta.waitFor({ timeout: 8000 });
  await page.waitForTimeout(700);
  await cta.click();
  await page.waitForTimeout(1100);
  const rects = await page.evaluate(() => {
    const r = (sel) => {
      const b = document.querySelector(sel)?.getBoundingClientRect();
      return b && { x: b.left + b.width / 2, y: b.top + b.height / 2, size: b.width };
    };
    return { logo: r("[data-splash-logo]"), mark: r("[data-hzy-mark-target]") };
  });
  const off = rects.logo && rects.mark
    ? Math.max(Math.abs(rects.logo.x - rects.mark.x), Math.abs(rects.logo.y - rects.mark.y), Math.abs(rects.logo.size - rects.mark.size))
    : Infinity;
  check("splash", "dock is inert under the splash", inertDuring === true, { inertDuring });
  check("splash", "logo lands on the dock mark (within 2px)", off <= 2, { ...rects, off });
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => {
    const a = document.querySelector(".dock-anchor");
    return { splash: a?.dataset.splash, inert: a?.hasAttribute("inert"), opacity: a && getComputedStyle(a).opacity };
  });
  check("splash", "dock shows and is interactive afterwards", after.splash === "false" && !after.inert && after.opacity === "1", after);
  await page.screenshot({ path: path.join(OUT, "splash-handoff.png") });
  await context.close();
}

// ── Lobby sections (1b): sphere, tree, orbs, wave, footer emblem, tour ─────────────
{
  // The sphere: a click knocks the facing letters loose and they grow back
  const { context, page, errors } = await chromePage();
  await page.goto(BASE + "/fx-harness/glyph-ball?room=lobby", { waitUntil: "networkidle" });
  await page.waitForSelector('[data-fx="glyph-ball"][data-fx-state="live"]', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(600);
  const box = await page.locator('[data-fx="glyph-ball"]').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(250);
  const loose = await page.evaluate(() => Number(document.querySelector('[data-fx="glyph-ball"] canvas')?.dataset.loose ?? -1));
  await page.waitForTimeout(3200);
  const regrown = await page.evaluate(() => Number(document.querySelector('[data-fx="glyph-ball"] canvas')?.dataset.loose ?? -1));
  check("glyph-ball", "a click knocks letters loose, and they all grow back", loose > 0 && regrown === 0, { loose, regrown });
  check("glyph-ball", "no page errors", errors.length === 0, errors.slice(0, 3));
  await context.close();
}

{
  const { context, page, errors } = await chromePage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const go = page.getByRole("button", { name: /let.s go/i });
  await go.waitFor({ timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(600);
  await go.click();
  await page.waitForFunction(() => document.querySelector("[data-lobby-backdrop]")?.dataset.lobbyPhase === "sequence", null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1200);
  const section = () => page.evaluate(() => document.querySelector("[data-sequence-section]")?.dataset.sequenceSection);
  const backdrop = () => page.evaluate(() => ({ ...document.querySelector("[data-lobby-backdrop]")?.dataset }));

  // Pointing at a room card leans the horizon toward it; leaving lets go
  await page.hover('.room-card[data-room="studio"]');
  await page.waitForTimeout(150);
  const leaning = (await backdrop()).tint;
  await page.mouse.move(20, 880);
  await page.waitForTimeout(150);
  const home = (await backdrop()).tint;
  check("lobby-hero", "room card hover tints the horizon, leaving returns it home", leaning === "studio" && home === "home", { leaning, home });

  // Space on a focused control belongs to the control, not the sequence
  await page.focus('.room-card[data-room="workshop"]');
  await page.keyboard.press(" ");
  await page.waitForTimeout(900);
  const afterSpace = await section();
  await page.mouse.click(20, 880);
  await page.keyboard.press(" ");
  await page.waitForTimeout(900);
  const afterBodySpace = await section();
  check("lobby-sequence", "Space on a focused link doesn't advance; on the page it does", afterSpace === "hero" && afterBodySpace === "about", { afterSpace, afterBodySpace });

  // Each slide poses the horizon
  const aboutLift = (await backdrop()).lift;
  check("lobby-sequence", "slides pose the horizon (about lowers it)", Number(aboutLift) < 0, { aboutLift });
  await page.waitForSelector('[data-fx="glyph-ball"][data-fx-state="live"]', { timeout: 10000 }).catch(() => {});
  await page.screenshot({ path: path.join(OUT, "lobby-1b-about.png") });

  // Seedling grows over its slide, and its milestones arrive with their branches
  await page.click('button[aria-label="Go to seedling section"]');
  await page.waitForFunction(() => document.querySelector('[data-fx="generative-tree"] canvas')?.dataset.growth === "1.00", null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);
  const tree = await page.evaluate(() => ({
    growth: document.querySelector('[data-fx="generative-tree"] canvas')?.dataset.growth,
    labels: [...document.querySelectorAll("[data-seedling-tip]")].map((el) => Number(getComputedStyle(el).opacity)),
  }));
  check("lobby-seedling", "tree grows through the slide; every milestone shows by the end", tree.growth === "1.00" && tree.labels.length === 7 && tree.labels.every((o) => o > 0.9), tree);
  await page.screenshot({ path: path.join(OUT, "lobby-1b-seedling.png") });

  // Tech words resolve into icon orbs (2D: no WebGL beyond the horizon)
  await page.click('button[aria-label="Go to techstack section"]');
  await page.waitForTimeout(5000);
  const orbs = await page.evaluate(() => ({
    live: document.querySelectorAll('[data-icon-orb] [data-fx-state="live"]').length,
    total: document.querySelectorAll("[data-icon-orb]").length,
    gl: window.__gl().live,
  }));
  check("lobby-techstack", "every icon word becomes a live orb; contexts within budget", orbs.total === 8 && orbs.live === 8 && orbs.gl <= 2, orbs);
  await page.screenshot({ path: path.join(OUT, "lobby-1b-techstack.png") });

  // The wave claims horizontal gestures; vertical ones still move the sequence
  await page.click('button[aria-label="Go to projects section"]');
  // The slide enters from the right: measure the stage only once it has settled on screen
  await page
    .waitForFunction(() => {
      const r = document.querySelector("[data-project-wave]")?.getBoundingClientRect();
      return !!r && r.left >= 0 && r.right <= innerWidth && document.querySelector('[data-wave-card][aria-current="true"]');
    }, null, { timeout: 8000 })
    .catch(() => {});
  await page.waitForTimeout(800);
  const current = () => page.evaluate(() => document.querySelector('[data-wave-card][aria-current="true"]')?.dataset.waveCard ?? null);
  const before = await current();
  const wave = await page.locator("[data-project-wave]").boundingBox();
  await page.mouse.move(wave.x + 10, wave.y + 10);
  await page.mouse.wheel(120, 0);
  await page
    .waitForFunction((b) => document.querySelector('[data-wave-card][aria-current="true"]')?.dataset.waveCard !== b, before, { timeout: 4000 })
    .catch(() => {});
  await page.waitForTimeout(300);
  const afterWheel = await current();
  const stayed = await section();

  // Wrapping back lands a padded copy in front: it must still take the click and link out.
  // The pointer at the stage's left edge leans the wave two and a half cards back, onto copies
  const frontCard = () =>
    page.evaluate(() => {
      const cards = [...document.querySelectorAll("[data-wave-card]")];
      return cards.reduce((a, b) => (Number(b.style.getPropertyValue("--focus")) > Number(a.style.getPropertyValue("--focus")) ? b : a)).dataset.waveCard;
    });
  const stage = await page.locator("[data-project-wave]").boundingBox();
  await page.mouse.move(stage.x + 4, stage.y + stage.height / 2, { steps: 4 });
  for (let i = 0; i < 20 && (await frontCard()) !== "copy"; i++) await page.waitForTimeout(200);
  const front = await page.evaluate(() => {
    const cards = [...document.querySelectorAll("[data-wave-card]")];
    const card = cards.reduce((a, b) => (Number(b.style.getPropertyValue("--focus")) > Number(a.style.getPropertyValue("--focus")) ? b : a));
    const r = card.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { which: card.dataset.waveCard, hitInside: card.contains(hit), link: !!card.querySelector("a[href^='/work/']") };
  });
  check("lobby-projects", "a padded copy in front takes clicks and links to its project", front.which === "copy" && front.hitInside && front.link, front);

  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(1000);
  const advanced = await section();
  check("lobby-projects", "horizontal wheel moves the wave and stays on the slide", before && afterWheel && afterWheel !== before && stayed === "projects", { before, afterWheel, stayed });
  check("lobby-projects", "vertical gestures still move the sequence", advanced === "cta", { advanced });

  // Out to the resting page: the tree follows the scroll, the footer and its emblem come back
  await page.click('button[aria-label="Go to tour section"]');
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "skip" }).click();
  await page.waitForFunction(() => document.querySelector("[data-lobby-backdrop]")?.dataset.lobbyPhase === "resting", null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(800);
  const growthAt = async (frac) => {
    await page.evaluate((f) => {
      const el = document.querySelector("[data-seedling-tree]");
      const top = el.getBoundingClientRect().top + scrollY;
      scrollTo(0, top - innerHeight * f);
    }, frac);
    await page.waitForTimeout(1500);
    return page.evaluate(() => Number(document.querySelector('[data-fx="generative-tree"] canvas')?.dataset.growth ?? -1));
  };
  const early = await growthAt(1.05);
  const later = await growthAt(0.1);
  check("lobby-seedling", "resting: the tree grows with the scroll", early >= 0 && later > early + 0.3, { early, later });

  await page.evaluate(() => document.querySelector('[data-lobby-section="projects"]').scrollIntoView());
  await page.waitForTimeout(800);
  const restingLift = (await backdrop()).lift;
  check("lobby-resting", "the section in view poses the horizon", restingLift === "0.14", { restingLift });

  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForSelector('[data-footer-emblem] [data-fx-state="live"]', { timeout: 10000 }).catch(() => {});
  const footer = await page.evaluate(() => ({
    display: getComputedStyle(document.querySelector("[data-site-footer]")).display,
    line: document.querySelector("[data-footer-line]")?.textContent,
    lines: Number(document.querySelector("[data-footer-emblem] canvas")?.dataset.lines ?? 0),
    state: document.querySelector("[data-footer-emblem] [data-fx]")?.dataset.fxState,
  }));
  check("lobby-footer", "footer back with its line, and the emblem traces the HZY outline", footer.display !== "none" && /glad/.test(footer.line ?? "") && footer.lines > 0 && footer.state === "live", footer);
  await page.screenshot({ path: path.join(OUT, "lobby-1b-footer.png") });

  // The tour: a modal with one live preview, Escape out, focus back on the opener
  const opener = page.getByRole("button", { name: "start guided tour" });
  await opener.scrollIntoViewIfNeeded();
  await opener.click();
  await page.waitForSelector('[data-tour-preview] [data-fx-state="live"]', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(400);
  const tour = await page.evaluate(() => ({
    dialog: !!document.querySelector('[role="dialog"][aria-modal="true"]'),
    focusIn: !!document.activeElement?.closest("[data-guided-tour]"),
    preview: document.querySelector("[data-tour-preview] [data-fx]")?.dataset.fx,
    previewState: document.querySelector("[data-tour-preview] [data-fx]")?.dataset.fxState,
    gl: window.__gl().live,
  }));
  let escaped = 0;
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press(i % 5 === 4 ? "Shift+Tab" : "Tab");
    if (!(await page.evaluate(() => !!document.activeElement?.closest("[data-guided-tour]")))) escaped++;
  }
  check("lobby-tour", "Tab and Shift+Tab stay inside the dialog", escaped === 0, { escaped });
  check("lobby-tour", "modal with focus inside and one live room preview", tour.dialog && tour.focusIn && tour.previewState === "live" && tour.gl <= 2, tour);
  await page.screenshot({ path: path.join(OUT, "lobby-1b-tour.png") });
  await page.keyboard.press("Escape");
  // The exit animation has to finish before the dialog unmounts and hands focus back
  await page.waitForFunction(() => !document.querySelector("[data-guided-tour]"), null, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(200);
  const closed = await page.evaluate(() => ({
    open: !!document.querySelector("[data-guided-tour]"),
    focus: document.activeElement?.getAttribute("aria-label"),
  }));
  check("lobby-tour", "Escape closes it and focus returns to the opener", !closed.open && closed.focus === "start guided tour", closed);

  check("lobby-1b", "no page errors", errors.length === 0, errors.slice(0, 3));
  await context.close();
}

{
  // Phone width: through the splash, straight out of the sequence, and down the resting page
  const { context, page, errors } = await chromePage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const go = page.getByRole("button", { name: /let.s go/i });
  await go.waitFor({ timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(600);
  await go.click();
  await page.waitForTimeout(1500);
  await page.click('button[aria-label="Go to tour section"]');
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "skip" }).click();
  await page.waitForFunction(() => document.querySelector("[data-lobby-backdrop]")?.dataset.lobbyPhase === "resting", null, { timeout: 8000 }).catch(() => {});
  let widest = 0;
  const H = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0, i = 0; y < H; y += 1600, i++) {
    await page.evaluate((top) => scrollTo(0, top), y);
    await page.waitForTimeout(700);
    widest = Math.max(widest, await page.evaluate(() => document.documentElement.scrollWidth));
    if (i < 4) await page.screenshot({ path: path.join(OUT, `lobby-1b-mobile-${i}.png`) });
  }
  check("lobby-mobile", "no horizontal scroll down the resting lobby at 390px", widest <= 390, { widest });
  check("lobby-mobile", "no page errors", errors.length === 0, errors.slice(0, 3));
  await context.close();
}

// ── Workshop (2): boot, backdrop, hidden files, life.log, the ask terminal, identity fields ──
{
  // First visit per session: the CRT boots, types the log and powers off into the IDE
  const { context, page, errors } = await chromePage();
  await page.goto(BASE + "/work", { waitUntil: "domcontentloaded" });
  const appeared = (sel, timeout) => page.waitForSelector(sel, { timeout }).then(() => true).catch(() => false);
  const booted = await appeared("[data-workshop-boot]", 8000);
  const crtLive = await appeared('[data-workshop-boot] [data-fx="crt-boot"][data-fx-state="live"]', 10000);
  const typed = await appeared('[data-workshop-boot] canvas[data-typed="done"]', 15000);
  await page.screenshot({ path: path.join(OUT, "workshop-boot.png") });
  const gone = await page.waitForFunction(() => !document.querySelector("[data-workshop-boot]"), null, { timeout: 8000 }).then(() => true).catch(() => false);
  await page.waitForTimeout(700);
  const after = await page.evaluate(() => ({
    flag: sessionStorage.getItem("hzy:workshop-booted"),
    gl: window.__gl().live,
    backdrop: document.querySelector("[data-workshop-backdrop] [data-fx]")?.dataset.fxState,
  }));
  check("workshop-boot", "first visit boots the CRT, types the log, powers off into the IDE", booted && crtLive && typed && gone && after.flag === "1", { booted, crtLive, typed, gone, ...after });
  check("workshop-boot", "the CRT's context goes with it: dock field and backdrop remain", after.gl <= 2 && after.backdrop === "live", after);
  await page.screenshot({ path: path.join(OUT, "workshop-ide.png") });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const again = await page.evaluate(() => !!document.querySelector("[data-workshop-boot]"));
  check("workshop-boot", "same session: no second boot", !again, { again });
  check("workshop-boot", "no page errors", errors.length === 0, errors.slice(0, 3));
  await context.close();
}

{
  // Any key skips the boot
  const { context, page } = await chromePage();
  await page.goto(BASE + "/work", { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-workshop-boot] [data-fx-state="live"]', { timeout: 10000 }).catch(() => {});
  await page.keyboard.press("Escape");
  const skipped = await page.waitForFunction(() => !document.querySelector("[data-workshop-boot]"), null, { timeout: 3000 }).then(() => true).catch(() => false);
  check("workshop-boot", "any key skips it", skipped, { skipped });
  await context.close();
}

{
  // Reduced motion never boots
  const { context, page } = await chromePage({ reducedMotion: "reduce" });
  await page.goto(BASE + "/work", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const boot = await page.evaluate(() => !!document.querySelector("[data-workshop-boot]"));
  check("workshop-boot", "reduced motion: straight to the IDE", !boot, { boot });
  await context.close();
}

{
  const { context, page, errors } = await chromePage();
  await context.addInitScript(() => {
    try {
      sessionStorage.setItem("hzy:workshop-booted", "1");
    } catch {}
  });
  // A slow answer from a stub of the ask endpoint, carrying one follow-up
  await page.route("**/api/ai/workshop", async (route) => {
    await new Promise((r) => setTimeout(r, 2400));
    const body = 'data: {"text":"a daemon that remembers what you build.\\n> what does it remember?"}\n\ndata: [DONE]\n\n';
    await route.fulfill({ status: 200, headers: { "content-type": "text/event-stream" }, body });
  });
  await page.goto(BASE + "/work", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  // Hidden files: a real switch with a springing thumb, and .debug appears
  const sw = page.getByRole("switch", { name: "hidden files" });
  const before = await sw.getAttribute("aria-checked");
  await sw.click();
  await page.waitForTimeout(800);
  const toggled = await page.evaluate(() => ({
    checked: document.querySelector('[role="switch"]')?.getAttribute("aria-checked"),
    debug: [...document.querySelectorAll("button")].some((b) => b.textContent?.trim() === ".debug"),
    thumb: getComputedStyle(document.querySelector(".toggle__thumb")).transform,
  }));
  const travelled = /matrix\(([^)]+)\)/.exec(toggled.thumb)?.[1].split(",").map(Number)[4] ?? 0;
  check("workshop-files", "the switch flips, its thumb travels, and .debug appears", before === "false" && toggled.checked === "true" && toggled.debug && travelled > 4, { before, ...toggled, travelled });

  // life.log decodes line by line over condensation, and every line keeps its left edge
  await page.getByRole("button", { name: /life\.log/ }).click();
  await page.waitForTimeout(3800);
  const log = await page.evaluate(() => {
    const lines = [...document.querySelectorAll("[data-life-log] pre > span")];
    return {
      count: lines.length,
      // The visible layer, not the wrapper: the wrapper stays put even when the layers misstack
      lefts: [...new Set(lines.map((l) => Math.round(l.querySelector(".decode__live")?.getBoundingClientRect().left ?? -1)))],
      settled: lines.every((l) => l.querySelector(".decode__live")?.textContent === l.querySelector(".sr-only")?.textContent),
      glass: document.querySelector("[data-life-log] [data-fx]")?.dataset.fxState,
    };
  });
  check("workshop-lifelog", "life.log decodes in, settles, and stays aligned over the condensation", log.count === 8 && log.lefts.length === 1 && log.settled && log.glass === "live", log);
  await page.screenshot({ path: path.join(OUT, "workshop-lifelog.png") });

  // The ask terminal: the run key primes on hover, a comet laps the input while it streams
  const run = page.locator("[data-life-log] [data-run-button]");
  const ignition = await run.locator("[data-fx]").getAttribute("data-fx-state");
  await run.hover();
  await page.waitForTimeout(400);
  const warp = await run.locator("canvas").first().getAttribute("data-warp");
  await run.click();
  const traced = await page.waitForSelector('[data-life-log] [data-fx="trace-border"][data-fx-state="live"]', { timeout: 2200 }).then(() => true).catch(() => false);
  await page.screenshot({ path: path.join(OUT, "workshop-ask-streaming.png") });
  const followed = await page.waitForSelector('[data-life-log] button:has-text("what does it remember?")', { timeout: 8000 }).then(() => true).catch(() => false);
  await page.waitForTimeout(1200);
  const done = await page.evaluate(() => ({
    trace: !!document.querySelector('[data-life-log] [data-fx="trace-border"]'),
    answer: document.querySelector("[data-life-log] pre.max-h-80")?.textContent ?? "",
  }));
  check("workshop-ask", "the run key's tunnel is live and primes on hover", ignition === "live" && warp === "1", { ignition, warp });
  check("workshop-ask", "a comet laps the input while the answer streams, and leaves after", traced && !done.trace, { traced, trace: done.trace });
  check("workshop-ask", "the answer lands and its follow-up decodes in", /remembers/.test(done.answer) && followed, { answer: done.answer, followed });
  check("workshop-ask", "no page errors", errors.length === 0, errors.slice(0, 3));
  await context.close();
}

{
  // Identity fields: the chosen visual in its accent, an unported choice falls back, links are keycaps
  for (const [variant, expect, maxGl] of [
    ["constellation-field", "constellation-field", 0],
    ["warp-field", "warp-field", 1],
    ["logic-core", "logic-core", 1],
    ["topo-field", "constellation-field", 0],
  ]) {
    const { context, page, errors } = await chromePage();
    await page.goto(BASE + `/fx-harness/project?variant=${variant}&accent=notebook-fragments`, { waitUntil: "networkidle" });
    await page.waitForSelector('[data-project-identity] [data-fx-state="live"]', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(600);
    const id = await page.evaluate(() => ({
      fx: document.querySelector("[data-project-identity] [data-fx]")?.dataset.fx,
      state: document.querySelector("[data-project-identity] [data-fx]")?.dataset.fxState,
      gl: window.__gl().live,
    }));
    const keycaps = await page.locator("a.cta--keycap").allTextContents();
    const named = (await page.getByRole("link", { name: "live site" }).count()) === 1 && (await page.getByRole("link", { name: "source" }).count()) === 1;
    check(`identity ${variant}`, `draws ${expect}, live, within budget`, id.fx === expect && id.state === "live" && id.gl <= maxGl, id);
    check(`identity ${variant}`, "links are keycaps named once", keycaps.length === 2 && named, { keycaps, named });
    check(`identity ${variant}`, "no page errors", errors.length === 0, errors.slice(0, 3));
    await page.screenshot({ path: path.join(OUT, `identity-${variant}.png`) });
    await context.close();
  }
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
