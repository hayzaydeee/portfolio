import type { FxPriority } from "./types";
import { tickerStats } from "./ticker";
import { audioStats } from "@/lib/audio/frame";

/**
 * WebGL context budget. Browsers silently drop the oldest context past ~16 (fewer on
 * iOS), so every GL stage leases a slot. When full, a request evicts an offscreen lease
 * of equal or lower priority (least recently visible first), then a visible lease of
 * strictly lower priority. If nothing qualifies the caller keeps showing its poster.
 */

export const MAX_LIVE_CONTEXTS = 6;

export type LeaseRequest = {
  id: string;
  priority: FxPriority;
  isVisible: () => boolean;
  /** Dispose the instance, lose the context and fall back to the poster */
  evict: () => void;
};

export type Lease = {
  id: string;
  priority: FxPriority;
  /** Report visibility. Going offscreen makes this lease evictable, so waiters get a retry */
  setVisible: (visible: boolean) => void;
  release: () => void;
};

type Entry = LeaseRequest & { lastVisible: number; reportedVisible: boolean };

type BudgetState = {
  leases: Map<string, Entry>;
  /** Stages waiting on a poster for a slot to free up */
  waiters: Set<() => void>;
  /** Total leases granted and creation attempts; the suite uses them to prove no remount churn */
  acquisitions: number;
  attempts: number;
};

const GLOBAL_KEY = "__hzyFxBudget";
type G = typeof globalThis & { [GLOBAL_KEY]?: BudgetState };

function budget(): BudgetState {
  const g = globalThis as G;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = { leases: new Map(), waiters: new Set(), acquisitions: 0, attempts: 0 };
    installDebugHandle();
  }
  return g[GLOBAL_KEY]!;
}

function live(): Map<string, Entry> {
  return budget().leases;
}

/**
 * Deferred, and the waiter set is read when the microtask runs: a stage that releases its own
 * lease (context loss) subscribes as a waiter right after, and must still hear about the slot
 */
function notifyFreed() {
  queueMicrotask(() => budget().waiters.forEach((cb) => cb()));
}

/** Debug counter: a stage started building an instance */
export function noteCreationAttempt() {
  budget().attempts += 1;
}

/** Called whenever a slot frees or a holder goes offscreen (evictable). Returns an unsubscribe. */
export function onLeaseFreed(cb: () => void): () => void {
  const { waiters } = budget();
  waiters.add(cb);
  return () => waiters.delete(cb);
}

function pickVictim(entries: Entry[], test: (e: Entry) => boolean): Entry | undefined {
  return entries.filter(test).sort((a, b) => a.priority - b.priority || a.lastVisible - b.lastVisible)[0];
}

export function acquireLease(req: LeaseRequest): Lease | null {
  const leases = live();
  if (leases.size >= MAX_LIVE_CONTEXTS) {
    const entries = [...leases.values()];
    const victim =
      pickVictim(entries, (e) => !e.isVisible() && e.priority <= req.priority) ??
      pickVictim(entries, (e) => e.priority < req.priority);
    if (!victim) return null;
    leases.delete(victim.id);
    victim.evict();
  }

  const entry: Entry = { ...req, lastVisible: performance.now(), reportedVisible: true };
  leases.set(req.id, entry);
  budget().acquisitions += 1;
  return {
    id: req.id,
    priority: req.priority,
    setVisible: (visible) => {
      if (visible) entry.lastVisible = performance.now();
      const wentHidden = entry.reportedVisible && !visible;
      entry.reportedVisible = visible;
      // Stages mount with optimistic visibility, so offscreen ones can win slots first;
      // when they report hidden, on-screen waiters retry and evict them
      if (wentHidden && leases.get(req.id) === entry) notifyFreed();
    },
    release: () => {
      if (leases.get(req.id) !== entry) return;
      leases.delete(req.id);
      notifyFreed();
    },
  };
}

/** window.__fx: live leases and ticker stats, read by the Playwright suite and the lab */
export function installDebugHandle() {
  if (typeof window === "undefined") return;
  (window as typeof window & { __fx?: unknown }).__fx = {
    live: () => live().size,
    acquisitions: () => budget().acquisitions,
    attempts: () => budget().attempts,
    leases: () => [...live().values()].map((e) => ({ id: e.id, priority: e.priority, visible: e.isVisible() })),
    stats: () => tickerStats(),
    audio: () => audioStats(),
  };
}
