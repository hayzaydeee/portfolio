import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

/**
 * Vercel Cron — runs hourly to unseal any scheduled wall pieces
 * whose publish_at has passed.
 *
 * Configured in vercel.json:
 * {
 *   "crons": [{ "path": "/api/cron/wall", "schedule": "0 * * * *" }]
 * }
 */
export async function GET(req: NextRequest) {
  // Verify Vercel cron secret to prevent unauthorised triggers
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  revalidatePath("/wall", "page");

  return NextResponse.json({
    ok: true,
    revalidated: "/wall",
    ts: new Date().toISOString(),
  });
}
