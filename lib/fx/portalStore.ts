import type { RoomKey } from "@/components/fx/runtime/types";
import { roomForPath } from "@/lib/rooms";

/**
 * Cross-room navigation as one state machine: cover the old room, push the route, hold
 * until the new room has painted, then reveal it. PortalHost renders whatever the state
 * says; TransitionLink starts it. Back/forward and reduced motion never enter it.
 *
 *   idle → covering (COVER_MS) → push → holding → revealing (REVEAL_MS) → idle
 */

export type PortalPhase = "idle" | "covering" | "holding" | "revealing";

export type PortalState = {
  phase: PortalPhase;
  from: RoomKey | null;
  to: RoomKey | null;
  href: string | null;
  /** performance.now() when the current phase started; effects animate from it */
  at: number;
  /** Increments per navigation so hosts can key per-trip state */
  trip: number;
};

type Router = { push: (href: string) => void; prefetch: (href: string) => void };

export const COVER_MS = 560;
export const REVEAL_MS = 520;
/** Longest we wait for a room's backdrop after its route has rendered */
export const READY_CAP_MS = 1200;
/** Longest a trip may keep the screen covered, whatever happens */
export const SAFETY_MS = 6000;

const IDLE: PortalState = { phase: "idle", from: null, to: null, href: null, at: 0, trip: 0 };

type Store = {
  state: PortalState;
  listeners: Set<() => void>;
  router: Router | null;
  timers: Map<TimerName, number>;
  /** Backdrops still painting their first frame, per room */
  pending: Map<RoomKey, number>;
  arrived: boolean;
  /** A click that landed while revealing; it starts once this trip has handed off */
  queued: string | null;
};

/** One slot each, so re-arming a timer always replaces the old one instead of stacking */
type TimerName = "phase" | "cap" | "safety";

const GLOBAL_KEY = "__hzyPortal";
type G = typeof globalThis & { [GLOBAL_KEY]?: Store };

function store(): Store {
  const g = globalThis as G;
  g[GLOBAL_KEY] ??= {
    state: IDLE,
    listeners: new Set(),
    router: null,
    timers: new Map(),
    pending: new Map(),
    arrived: false,
    queued: null,
  };
  return g[GLOBAL_KEY]!;
}

function set(patch: Partial<PortalState>) {
  const s = store();
  s.state = { ...s.state, ...patch };
  s.listeners.forEach((l) => l());
}

function clear(name: TimerName) {
  const { timers } = store();
  const id = timers.get(name);
  if (id !== undefined) clearTimeout(id);
  timers.delete(name);
}

function later(name: TimerName, fn: () => void, ms: number) {
  clear(name);
  store().timers.set(name, window.setTimeout(fn, ms));
}

function clearTimers() {
  (["phase", "cap", "safety"] as const).forEach(clear);
}

export function getPortal(): PortalState {
  return store().state;
}

export function getServerPortal(): PortalState {
  return IDLE;
}

export function subscribePortal(cb: () => void): () => void {
  const { listeners } = store();
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Whether a click from `pathname` to `href` should travel through the portal */
export function crossesRooms(pathname: string, href: string): boolean {
  const from = roomForPath(pathname);
  const to = roomForPath(href);
  return from !== null && to !== null && from !== to;
}

export function portalGo(href: string, router: Router) {
  const s = store();
  s.router = router;
  router.prefetch(href);
  const { phase } = s.state;

  // Last href wins. While covering, the push at the end of the cover picks it up;
  // once covered, push straight away and keep holding. The old target's readiness cap
  // must not reveal the new one, so it goes too.
  if (phase === "covering") {
    set({ href, to: roomForPath(href) });
    return;
  }
  if (phase === "holding") {
    set({ href, to: roomForPath(href) });
    s.arrived = false;
    clear("cap");
    router.push(href);
    return;
  }
  // Mid-reveal: let this trip finish (idle + focus), then start the new one from there
  if (phase === "revealing") {
    s.queued = href;
    return;
  }

  clearTimers();
  s.arrived = false;
  s.queued = null;
  const from = roomForPath(window.location.pathname);
  set({ phase: "covering", from, to: roomForPath(href), href, at: performance.now(), trip: s.state.trip + 1 });

  later(
    "phase",
    () => {
      const { href: target } = store().state;
      set({ phase: "holding", at: performance.now() });
      if (target) store().router?.push(target);
    },
    COVER_MS
  );
  later("safety", reveal, SAFETY_MS);
}

function reveal() {
  const { phase } = store().state;
  if (phase !== "covering" && phase !== "holding") return;
  clearTimers();
  set({ phase: "revealing", at: performance.now() });
  // Focus and any queued click are handled by PortalHost once idle has rendered and the
  // page is no longer inert (an inert heading can't take focus)
  later("phase", () => set({ phase: "idle", at: performance.now() }), REVEAL_MS);
}

/** The click that landed mid-reveal, if any; clears it */
export function takeQueued(): string | null {
  const s = store();
  const next = s.queued;
  s.queued = null;
  return next;
}

/** Back/forward: never leave the screen covered, and drop any click queued behind the reveal */
export function portalAbort() {
  const s = store();
  s.queued = null;
  if (s.state.phase === "covering" || s.state.phase === "holding") reveal();
}

function check() {
  const s = store();
  const { phase, to } = s.state;
  if (phase !== "holding" || !s.arrived || !to) return;
  if ((s.pending.get(to) ?? 0) === 0) reveal();
}

/**
 * PortalHost reports every pathname it renders. Arrival in the target room waits two frames
 * so the new route's effects can register their backdrops, then reveals once they paint.
 */
export function portalArrived(pathname: string) {
  const s = store();
  const { phase, to } = s.state;
  if (phase !== "holding" || roomForPath(pathname) !== to) return;
  s.arrived = true;
  requestAnimationFrame(() => requestAnimationFrame(check));
  later("cap", reveal, READY_CAP_MS);
}

/**
 * Backdrops call this on mount; the room counts as ready once every hold is released
 * (first frame, error, eviction to poster or unmount). Returns an idempotent release.
 */
export function holdRoomReveal(room: RoomKey): () => void {
  const { pending } = store();
  pending.set(room, (pending.get(room) ?? 0) + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    pending.set(room, Math.max(0, (pending.get(room) ?? 1) - 1));
    check();
  };
}

export function focusArrival() {
  const heading = document.querySelector<HTMLElement>("main h1") ?? document.querySelector<HTMLElement>("h1");
  if (!heading) return;
  if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
  heading.focus({ preventScroll: true });
}
