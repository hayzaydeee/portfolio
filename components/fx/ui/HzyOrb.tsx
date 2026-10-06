"use client";

import { useState, type Ref } from "react";
import { cn } from "@/lib/utils";
import { HzyMark } from "@/components/nav/HzyMark";
import { FxStage, type FxHandle } from "@/components/fx/FxStage";
import type { HzyOrbOptions } from "@/components/fx/effects/hzy-orb/meta";
import type { RoomKey } from "@/components/fx/runtime/types";
import { usePrimRoom } from "./usePrimRoom";

const SIZE_CLASS = {
  sm: "size-5",
  md: "size-14",
  lg: "size-30",
} as const;

const LIGHT_ROOMS: ReadonlySet<RoomKey> = new Set(["notebook", "wall"]);

type Props = {
  size?: keyof typeof SIZE_CLASS;
  room?: RoomKey;
  /** Gives the orb role="img" with this name; without it the orb is decorative */
  label?: string;
  motion?: HzyOrbOptions["motion"];
  /** Send "pulse" for a ring of light from the centre */
  handle?: Ref<FxHandle>;
  className?: string;
};

/**
 * The HZY mark as a living dot lattice (2D canvas on the shared ticker, no WebGL slot).
 * The flat mark sits underneath until the first frame, and again whenever the stage is
 * disabled or has failed.
 */
export function HzyOrb({ size = "md", room, label, motion, handle, className }: Props) {
  const scope = usePrimRoom(room);
  const [live, setLive] = useState(false);

  return (
    <span
      className={cn("relative inline-block shrink-0", SIZE_CLASS[size], className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-hzy-orb={size}
    >
      <HzyMark
        mode={LIGHT_ROOMS.has(scope) ? "light" : "dark"}
        className={cn("absolute inset-0 transition-opacity duration-500", live ? "opacity-0" : "opacity-40")}
      />
      <FxStage
        effect="hzy-orb"
        room={scope}
        options={motion ? { motion } : undefined}
        className="absolute inset-0"
        posterClassName="bg-transparent"
        handle={handle}
        onStatusChange={(status) => setLive(status === "live")}
      />
    </span>
  );
}
