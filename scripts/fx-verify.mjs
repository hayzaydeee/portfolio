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
  window.__portal = { log: [], live: false, pushes: 0 };
  const push = history.pushState;
  history.pushState = function (...args) {
    window.__portal.pushes++;
    return push.apply(this, args);
  };
  const watch = () => {
    const el = document.querySelector("[data-portal-state]");
    if (!el) return requestAnimationFrame(watch);
    let last = null;
    const record = () => {
      const s = el.dataset.portalState;
      if (el.dataset.portalLive) window.__portal.live = true;
      if (s !== last) window.__portal.log.push(s);
      last = s;
    };
    record();
    new MutationObserver(record).observe(el, { attributes: true });
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
  check(route.name, "single creation, no remount churn", churn.attempts === 1 && churn.acquisitions === 1, churn);

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
  check("portal", "walks covering > holding > revealing > idle", /covering>holding>revealing>idle$/.test(walk), { walk });
  check("portal", "effect went live during the trip", portal.live, portal);
  check("portal", "exactly one history push", portal.pushes === 1, { pushes: portal.pushes });
  check("portal", "new room's heading takes focus", portal.focused === "workshop", { focused: portal.focused });
  check("portal", "no page errors", errors.length === 0, errors.slice(0, 3));

  const before = portal.log.length;
  await page.goBack();
  await page.waitForFunction(() => location.pathname === "/colophon", null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1200);
  const back = await page.evaluate((n) => window.__portal.log.slice(n), before);
  check("portal", "back/forward never covers", !back.includes("covering"), { back });
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
