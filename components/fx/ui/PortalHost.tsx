"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { motion } from "motion/react";
import { FxStage, type FxHandle } from "@/components/fx/FxStage";
import { useFxGlobals } from "@/components/fx/FxConfig";
import { ROOM_POSTER_CLASS } from "@/components/fx/posters";
import type { PortalPhaseCommand } from "@/components/fx/effects/portal-timeline";
import {
  COVER_MS,
  REVEAL_MS,
  crossesRooms,
  focusArrival,
  getPortal,
  getServerPortal,
  portalAbort,
  portalArrived,
  portalGo,
  subscribePortal,
  takeQueued,
  type PortalPhase,
} from "@/lib/fx/portalStore";
import type { FxSlotId } from "@/lib/fx/slots";
import type { RoomKey } from "@/components/fx/runtime/types";
import { cn } from "@/lib/utils";

const SLOT_FOR = { field: "portal.field", vortex: "portal.vortex" } as const satisfies Record<string, FxSlotId>;

const ROOM_NAME: Record<RoomKey, string> = {
  lobby: "the lobby",
  workshop: "the workshop",
  studio: "the studio",
  notebook: "the notebook",
  wall: "the wall",
};

/** Body children that must stay usable under the cover: the host itself, the player, Next's route announcer */
const KEEP = "[data-portal-state], [data-portal-keep], next-route-announcer, script";

const EFFECT_PHASE: Record<Exclude<PortalPhase, "idle">, PortalPhaseCommand["name"]> = {
  covering: "cover",
  holding: "hold",
  revealing: "reveal",
};

/**
 * Renders the room transition above everything except the player. A flat cover in the
 * destination room's base colour always runs underneath, so the screen is covered even
 * before the effect's first frame (or when the lab picks "fade"); once the effect is live
 * it draws its own cover and the flat one steps aside. While a trip runs, everything else
 * on the page is inert, so keyboard and assistive tech can't reach what the cover hides.
 */
export function PortalHost() {
  const state = useSyncExternalStore(subscribePortal, getPortal, getServerPortal);
  const pathname = usePathname();
  const { transition } = useFxGlobals();
  const router = useRouter();
  const handle = useRef<FxHandle>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const [liveTrip, setLiveTrip] = useState(-1);
  const live = liveTrip === state.trip;
  const active = state.phase !== "idle";

  useEffect(() => {
    portalArrived(pathname);
  }, [pathname]);

  useEffect(() => {
    window.addEventListener("popstate", portalAbort);
    // Debug handle for the verification suite (same surface as clicking a dock link)
    const g = window as typeof window & { __fxPortal?: { go: (href: string) => void } };
    g.__fxPortal = { go: (href) => portalGo(href, router) };
    return () => window.removeEventListener("popstate", portalAbort);
  }, [router]);

  // One pass per trip, before paint: everything already on the page goes inert in the layout
  // phase, and nodes the incoming route adds are caught by the observer's microtask, which
  // also runs before the frame paints. Focus that lands outside the portal is pulled back.
  useLayoutEffect(() => {
    if (!active) return;
    const marked = new Set<HTMLElement>();
    const host = statusRef.current?.parentElement ?? null;
    const reclaim = () => {
      const focused = document.activeElement;
      if (focused && host?.contains(focused)) return;
      if (focused?.closest("[data-portal-keep]")) return;
      statusRef.current?.focus({ preventScroll: true });
    };
    const mark = (nodes: Iterable<Node>) => {
      for (const el of nodes) {
        if (!(el instanceof HTMLElement) || el.matches(KEEP) || el.inert) continue;
        el.inert = true;
        marked.add(el);
      }
    };
    mark(document.body.children);
    const observer = new MutationObserver((records) => {
      for (const record of records) mark(record.addedNodes);
      reclaim();
    });
    observer.observe(document.body, { childList: true });
    document.addEventListener("focusin", reclaim);
    return () => {
      observer.disconnect();
      document.removeEventListener("focusin", reclaim);
      marked.forEach((el) => (el.inert = false));
    };
  }, [active]);

  // Focus leaves the page with the cover, then lands on the new room's heading. The inert
  // pass is a layout effect, so on the idle commit it has been lifted before this runs.
  const prevPhase = useRef(state.phase);
  useEffect(() => {
    const from = prevPhase.current;
    prevPhase.current = state.phase;
    if (state.phase === "covering") statusRef.current?.focus({ preventScroll: true });
    if (state.phase !== "idle" || from !== "revealing") return;
    focusArrival();
    const next = takeQueued();
    if (next && crossesRooms(window.location.pathname, next)) portalGo(next, router);
    else if (next) router.push(next);
  }, [state.phase, state.trip, router]);

  useEffect(() => {
    if (state.phase === "idle") return;
    handle.current?.command("phase", {
      name: EFFECT_PHASE[state.phase],
      at: state.at,
      ms: state.phase === "covering" ? COVER_MS : state.phase === "revealing" ? REVEAL_MS : 0,
      from: state.from,
      to: state.to,
    } satisfies PortalPhaseCommand);
  }, [state]);

  const slot = transition === "field" || transition === "vortex" ? SLOT_FOR[transition] : null;
  const to = state.to ?? "lobby";

  let coverOpacity = 0;
  let coverSeconds = 0.15;
  if (state.phase === "covering") {
    coverOpacity = live ? 0 : 1;
    coverSeconds = COVER_MS / 1000;
  } else if (state.phase === "holding") {
    coverOpacity = 1;
  } else if (state.phase === "revealing") {
    coverSeconds = live ? 0 : REVEAL_MS / 1000;
  }

  return (
    <div
      className={cn("fixed inset-0 z-(--z-portal)", active ? "pointer-events-auto" : "pointer-events-none")}
      data-portal-state={state.phase}
      data-portal-live={live || undefined}
    >
      <p ref={statusRef} role="status" tabIndex={-1} className="sr-only">
        {active ? `entering ${ROOM_NAME[to]}` : ""}
      </p>
      {active && (
        <div aria-hidden="true">
          <motion.div
            key={`cover-${state.trip}`}
            className={cn("absolute inset-0", ROOM_POSTER_CLASS[to])}
            initial={{ opacity: 0 }}
            animate={{ opacity: coverOpacity }}
            transition={{ duration: coverSeconds, ease: [0.65, 0, 0.35, 1] }}
          />
          {slot && (
            <FxStage
              key={state.trip}
              slot={slot}
              room={to}
              className="absolute inset-0"
              posterClassName="bg-transparent"
              fade={false}
              handle={handle}
              onStatusChange={(status) => {
                if (status === "live") setLiveTrip(state.trip);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
