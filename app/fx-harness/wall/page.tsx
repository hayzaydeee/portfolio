import { notFound } from "next/navigation";
import { connection } from "next/server";
import { WallPage } from "@/components/wall/WallPage";
import { WallBackdrop } from "@/components/wall/WallBackdrop";
import { SEALED_FIXTURE, WALL_FIXTURE } from "./fixtures";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * The wall from fixtures, inside the room's own layout, for Playwright and screenshots without a
 * database. `?empty=1` shows the placeholders an empty wall falls back to; `?sealed=0` drops the seals.
 */
export default async function WallHarness({ searchParams }: Props) {
  await connection();
  if (process.env.NODE_ENV === "production" && process.env.FX_HARNESS !== "1") notFound();
  const sp = await searchParams;
  return (
    <div className="isolate min-h-screen bg-(--wall-surface) text-(--wall-caption)">
      <WallBackdrop />
      <WallPage pieces={sp.empty === "1" ? [] : WALL_FIXTURE} sealed={sp.sealed === "0" ? [] : SEALED_FIXTURE} />
    </div>
  );
}
