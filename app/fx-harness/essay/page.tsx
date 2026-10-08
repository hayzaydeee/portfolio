import { notFound } from "next/navigation";
import { connection } from "next/server";
import { EssayView } from "@/components/studio/EssayView";
import { StudioBackdrop } from "@/components/studio/StudioBackdrop";
import { ESSAYS } from "../studio/essays";

/** One essay from the studio fixtures, on the room's backdrop, for Playwright and screenshots */
export default async function EssayHarness() {
  await connection();
  if (process.env.NODE_ENV === "production" && process.env.FX_HARNESS !== "1") notFound();

  return (
    // isolate: the backdrop's negative z stays above the harness layout's own background
    <main className="relative isolate min-h-screen text-(--studio-text)">
      <StudioBackdrop />
      <EssayView essay={ESSAYS[0]} />
    </main>
  );
}
