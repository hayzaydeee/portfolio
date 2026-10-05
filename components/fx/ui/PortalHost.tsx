"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { motion } from "motion/react";
import { FxStage, type FxHandle } from "@/components/fx/FxStage";
import { useFxGlobals } from "@/components/fx/FxConfig";
import { ROOM_POSTER_CLASS } from "@/components/fx/posters";
import type { PortalPhaseCommand } from "@/components/fx/effects/portal-timeline";
import {
  COVER_MS,
  REVEAL_MS,
  getPortal,
  getServerPortal,
  portalAbort,
  portalArrived,
  subscribePortal,
  type PortalPhase,
} from "@/lib/fx/portalStore";
import type { FxSlotId } from "@/lib/fx/slots";
import { cn } from "@/lib/utils";

const SLOT_FOR = { field: "portal.field", vortex: "portal.vortex" } as const satisfies Record<string, FxSlotId>;

const EFFECT_PHASE: Record<Exclude<PortalPhase, "idle">, PortalPhaseCommand["name"]> = {
  covering: "cover",
  holding: "hold",
  revealing: "reveal",
};

/**
 * Renders the room transition above everything except the player. A flat cover in the
 * destination room's base colour always runs underneath, so the screen is covered even
 * before the effect's first frame (or when the lab picks "fade"); once the effect is live
 * it draws its own cover and the flat one steps aside.
 */
export function PortalHost() {
  const state = useSyncExternalStore(subscribePortal, getPortal, getServerPortal);
  const pathname = usePathname();
  const { transition } = useFxGlobals();
  const handle = useRef<FxHandle>(null);
  const [liveTrip, setLiveTrip] = useState(-1);
  const live = liveTrip === state.trip;

  useEffect(() => {
    portalArrived(pathname);
  }, [pathname]);

  useEffect(() => {
    window.addEventListener("popstate", portalAbort);
    return () => window.removeEventListener("popstate", portalAbort);
  }, []);

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

  const active = state.phase !== "idle";
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
      aria-hidden="true"
    >
      {active && (
        <>
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
        </>
      )}
    </div>
  );
}
