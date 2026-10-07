"use client";

import { useState, type ComponentType, type Ref } from "react";
import { cn } from "@/lib/utils";
import { FxStage, type FxHandle } from "@/components/fx/FxStage";
import type { HzyOrbOptions } from "@/components/fx/effects/hzy-orb/meta";
import type { RoomKey } from "@/components/fx/runtime/types";
import { usePrimRoom } from "./usePrimRoom";

type IconComponent = ComponentType<{ size?: number; className?: string; title?: string }>;

type Props = {
  /** A simple-icons component: its glyph is the poster, and its path is what the orb samples */
  Icon: IconComponent;
  room?: RoomKey;
  motion?: HzyOrbOptions["motion"];
  density?: number;
  handle?: Ref<FxHandle>;
  className?: string;
};

/**
 * Any filled icon as an hzy-orb dot lattice. The flat icon renders first (and stays if the
 * stage never goes live); its own path data is read from the DOM and handed to the renderer,
 * so the orb is always the same shape as the glyph it replaces. Decorative: the word it
 * stands for carries the meaning.
 */
export function IconOrb({ Icon, room, motion = "diag", density = 34, handle, className }: Props) {
  const scope = usePrimRoom(room);
  const [path, setPath] = useState("");
  const [live, setLive] = useState(false);

  return (
    <span className={cn("prim relative inline-block shrink-0", className)} data-room={scope} aria-hidden="true" data-icon-orb="">
      <span
        className={cn("absolute inset-[7%] text-(--prim-ink) transition-opacity duration-500", live ? "opacity-0" : "opacity-80")}
        ref={(el) => {
          const d = el?.querySelector("path")?.getAttribute("d");
          if (d && d !== path) setPath(d);
        }}
      >
        <Icon size={24} className="size-full" title="" />
      </span>
      {path && (
        <FxStage
          effect="hzy-orb"
          room={scope}
          options={{ path, viewBox: 24, density, motion }}
          className="absolute inset-0"
          posterClassName="bg-transparent"
          handle={handle}
          onStatusChange={(status) => setLive(status === "live")}
        />
      )}
    </span>
  );
}
