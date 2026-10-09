import { notFound } from "next/navigation";
import { connection } from "next/server";
import { JournalDesk } from "@/components/notebook/JournalDesk";
import { SHELF_FIXTURE } from "./shelf";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * The notebook's desk from fixtures, for Playwright and screenshots without a database.
 * `?exposure=`, `?environment=` and `?tint=` override the shelf's lab values, for tuning.
 */
export default async function NotebookHarness({ searchParams }: Props) {
  await connection();
  if (process.env.NODE_ENV === "production" && process.env.FX_HARNESS !== "1") notFound();
  const sp = await searchParams;
  const num = (key: string) => (typeof sp[key] === "string" && Number.isFinite(Number(sp[key])) ? Number(sp[key]) : undefined);
  const shelfOptions = Object.fromEntries(
    (["exposure", "environment", "tint"] as const).map((k) => [k, num(k)]).filter(([, v]) => v !== undefined)
  );
  return (
    <div className="bg-(--notebook-surface) text-(--notebook-text)">
      <JournalDesk shelf={SHELF_FIXTURE} shelfOptions={shelfOptions} />
    </div>
  );
}
