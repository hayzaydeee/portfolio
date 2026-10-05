import { notFound } from "next/navigation";
import { FX_METAS, isFxId } from "@/components/fx/metas";
import { ROOM_KEYS } from "@/components/fx/runtime/palette";
import type { RoomKey } from "@/components/fx/runtime/types";
import { HarnessClient } from "@/components/fx/harness/HarnessClient";

type Props = {
  params: Promise<{ effect: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Full-screen single-effect page for Playwright (context counts, frame timing, posters,
 * fidelity screenshots). Off in production unless FX_HARNESS=1.
 */
export default async function FxHarnessPage({ params, searchParams }: Props) {
  if (process.env.NODE_ENV === "production" && process.env.FX_HARNESS !== "1") notFound();

  const { effect } = await params;
  if (!isFxId(effect)) notFound();
  const sp = await searchParams;

  const roomParam = typeof sp.room === "string" ? sp.room : "";
  const room: RoomKey = (ROOM_KEYS as string[]).includes(roomParam)
    ? (roomParam as RoomKey)
    : FX_METAS[effect].rooms[0];

  const count = Math.min(12, Math.max(1, Number(sp.count) || 1));
  // Only same-origin paths or https URLs (the CSP media-src decides what actually loads)
  const audioSrc =
    typeof sp.audioSrc === "string" && /^(\/|https:\/\/)/.test(sp.audioSrc) ? sp.audioSrc : "/fx-test/kick.mp3";

  return (
    <HarnessClient
      effect={effect}
      room={room}
      sourcePalette={sp.source === "1"}
      withAudio={sp.audio === "1"}
      audioSrc={audioSrc}
      count={count}
    />
  );
}
