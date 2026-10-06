import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ROOM_POSTER_CLASS } from "@/components/fx/posters";
import { ROOM_KEYS } from "@/components/fx/runtime/palette";
import type { RoomKey } from "@/components/fx/runtime/types";
import { CircleButton } from "@/components/fx/ui/CircleButton";
import { Cta } from "@/components/fx/ui/Cta";
import { Decode } from "@/components/fx/ui/Decode";
import { HzyOrb } from "@/components/fx/ui/HzyOrb";
import { cn } from "@/lib/utils";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const INK: Record<RoomKey, string> = {
  lobby: "text-(--lobby-text)",
  workshop: "text-(--workshop-text)",
  studio: "text-(--studio-text)",
  notebook: "text-(--notebook-text)",
  wall: "text-(--wall-caption)",
};

const PLAY = (
  <svg viewBox="0 0 32 32" fill="currentColor">
    <path d="M11.75 8.7c0-1.28 1.4-2.08 2.5-1.43l12 7.3a1.66 1.66 0 0 1 0 2.86l-12 7.3a1.66 1.66 0 0 1-2.5-1.43V8.7Z" />
  </svg>
);
const PLUS = (
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M16 7v18M7 16h18" />
  </svg>
);
const LOOP = (
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 13a7 7 0 0 1 12-4l3 3M24 19a7 7 0 0 1-12 4l-3-3M23 6v6h-6M9 26v-6h6" />
  </svg>
);

/**
 * Every UI primitive in every room, for Playwright and screenshots. ?room=studio narrows
 * to one room; ?decodeDelay=ms holds the first decode back so a test can catch it mid-run;
 * ?orbs=0 leaves the orbs out (a software renderer can't keep fifteen of them at frame rate).
 */
export default async function PrimitivesHarnessPage({ searchParams }: Props) {
  // Render per request: FX_HARNESS is read at runtime, never baked in at build
  await connection();
  if (process.env.NODE_ENV === "production" && process.env.FX_HARNESS !== "1") notFound();

  const sp = await searchParams;
  const roomParam = typeof sp.room === "string" ? sp.room : "";
  const rooms = (ROOM_KEYS as string[]).includes(roomParam) ? [roomParam as RoomKey] : ROOM_KEYS;
  const decodeDelay = Math.max(0, Number(sp.decodeDelay) || 0);
  const orbs = sp.orbs !== "0";

  return (
    <main className="flex flex-col">
      {rooms.map((room, i) => (
        <section
          key={room}
          data-testid={`prim-${room}`}
          className={cn("flex flex-col gap-10 px-8 py-16", ROOM_POSTER_CLASS[room], INK[room])}
        >
          <Decode
            as="h2"
            text={`the ${room}`}
            delay={i === 0 ? decodeDelay : 0}
            className="font-mono text-2xl"
            id={`decode-${room}`}
          />

          <div className="flex flex-wrap items-center gap-6">
            <Cta room={room} variant="slide" label="see the work" />
            <Cta room={room} variant="beam" label="start here" />
            <Cta room={room} variant="spin" label="request a demo" />
            <Cta room={room} variant="trace" label="say hello" href="mailto:hayzayd33@gmail.com" />
            <Cta room={room} variant="keycap" label="enter" emphasis="primary" />
            <Cta room={room} variant="keycap" label="read the notes" />
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <Cta room={room} variant="slide" label="small slide" size="sm" />
            <Cta room={room} variant="beam" label="small beam" size="sm" />
            <Cta room={room} variant="spin" label="small spin" size="sm" />
            <Cta room={room} variant="trace" label="small trace" size="sm" />
            <Cta room={room} variant="keycap" label="small key" size="sm" emphasis="primary" />
            <Cta room={room} variant="slide" label="disabled" disabled />
          </div>

          <div className="flex flex-wrap items-center gap-8">
            <CircleButton room={room} variant="glass" label="play" icon={PLAY} />
            <CircleButton room={room} variant="key" label="add" icon={PLUS} />
            <CircleButton room={room} variant="trace" label="loop" icon={LOOP} pressed={false} />
            <CircleButton room={room} variant="key" label="loop on" icon={LOOP} pressed />
            <CircleButton room={room} variant="glass" label="small play" icon={PLAY} size="sm" />
          </div>

          {orbs && (
            <div className="flex flex-wrap items-end gap-8">
              <HzyOrb room={room} size="sm" />
              <HzyOrb room={room} size="md" label={`hzy orb, ${room}`} />
              <HzyOrb room={room} size="lg" motion="sweep" />
            </div>
          )}

          <Decode
            as="p"
            trigger="visible"
            text={`decoded when it scrolls into view, in the ${room}`}
            className="max-w-md font-mono text-sm opacity-70"
          />
        </section>
      ))}
    </main>
  );
}
