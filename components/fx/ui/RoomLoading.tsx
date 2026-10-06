"use client";

import { useEffect } from "react";
import { holdRoomReveal } from "@/lib/fx/portalStore";
import type { RoomKey } from "@/components/fx/runtime/types";
import { Decode, DECODE_MONO_POOL } from "./Decode";
import { HzyOrb } from "./HzyOrb";

const LINE: Record<RoomKey, string> = {
  lobby: "coming in",
  workshop: "booting the workshop",
  studio: "tuning the studio",
  notebook: "opening the notebook",
  wall: "hanging the wall",
};

const TONE: Record<RoomKey, string> = {
  lobby: "text-(--lobby-text)",
  workshop: "text-(--workshop-text-muted)",
  studio: "text-(--studio-text-muted)",
  notebook: "text-(--notebook-text-muted)",
  wall: "text-(--wall-date)",
};

/**
 * A room's loading state (rendered by its loading.tsx). While it is on screen it holds the
 * portal's reveal, so content that streams in under the readiness cap is revealed directly;
 * slower content reveals onto this instead of keeping the cover up. It carries no heading:
 * PortalHost waits for it to leave before focusing the room's h1.
 */
export function RoomLoading({ room }: { room: RoomKey }) {
  useEffect(() => holdRoomReveal(room), [room]);

  return (
    <div
      data-room-loading={room}
      role="status"
      className="flex min-h-[70svh] flex-1 flex-col items-center justify-center gap-5 py-24"
    >
      <HzyOrb size="md" room={room} />
      <Decode
        as="p"
        text={LINE[room]}
        pool={room === "workshop" ? DECODE_MONO_POOL : undefined}
        duration={720}
        className={`font-mono text-xs tracking-widest ${TONE[room]}`}
      />
    </div>
  );
}
