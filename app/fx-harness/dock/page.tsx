import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ROOM_KEYS } from "@/components/fx/runtime/palette";
import type { RoomKey } from "@/components/fx/runtime/types";
import { Dock } from "@/components/fx/ui/Dock";
import { RoomsProvider } from "@/components/fx/ui/RoomsContext";
import { DOCK_VARIANT, ROOM_LINKS, type RoomVisibility } from "@/lib/rooms";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * One dock on its own for Playwright: ?room=wall picks the room (and so the variant),
 * ?hide=wall,studio simulates rooms switched off in admin settings.
 */
export default async function DockHarnessPage({ searchParams }: Props) {
  // Render per request: FX_HARNESS is read at runtime, never baked in at build
  await connection();
  if (process.env.NODE_ENV === "production" && process.env.FX_HARNESS !== "1") notFound();

  const sp = await searchParams;
  const roomParam = typeof sp.room === "string" ? sp.room : "";
  const room: RoomKey = (ROOM_KEYS as string[]).includes(roomParam) ? (roomParam as RoomKey) : "lobby";
  const hidden = new Set(typeof sp.hide === "string" ? sp.hide.split(",") : []);
  const rooms = Object.fromEntries(ROOM_LINKS.map((l) => [l.room, !hidden.has(l.room)])) as RoomVisibility;

  return (
    <RoomsProvider rooms={rooms}>
      <main className="relative min-h-screen p-8">
        <Dock variant={DOCK_VARIANT[room]} room={room} />
      </main>
    </RoomsProvider>
  );
}
