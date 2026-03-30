import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// ─── Rate limiter ─────────────────────────────────────────────────────────────

let ratelimit: Ratelimit | null = null;
try {
  ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(20, "1 m"),
  });
} catch {
  console.warn("[ingest] Upstash Redis not configured — rate limiting disabled");
}

// ─── Payload schema ───────────────────────────────────────────────────────────

const bitoPayloadSchema = z.object({
  title: z.string().max(200).optional(),
  body: z.string().min(1),
  journal: z
    .enum(["reflections", "fragments", "annotations", "responses", "buildlog"])
    .optional()
    .default("fragments"),
  tags: z.array(z.string().max(50)).max(10).optional().default([]),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function estimateReadTime(text: string): number {
  const words = text
    .replace(/<[^>]+>/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function verifySignature(secret: string, body: string, sig: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const sigBytes = hexToBytes(sig.replace(/^sha256=/, ""));
    return await crypto.subtle.verify("HMAC", key, sigBytes, encoder.encode(body));
  } catch {
    return false;
  }
}

function hexToBytes(hex: string): ArrayBuffer {
  const buf = new ArrayBuffer(hex.length / 2);
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return buf;
}

function generateSlug(title: string | undefined, id: string): string {
  if (!title) return id.slice(0, 8);
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Rate limit by IP before any DB access
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (ratelimit) {
    const { success } = await ratelimit.limit(`bito:${ip}`);
    if (!success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
  }

  const rawBody = await req.text();

  // Get the stored webhook secret from Supabase
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("site_settings")
    .select("bito_webhook_secret")
    .limit(1)
    .single();

  const secret = settings?.bito_webhook_secret;
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  // Verify HMAC signature
  const signature = req.headers.get("x-bito-signature") ?? "";
  const valid = await verifySignature(secret, rawBody, signature);
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Parse and validate payload
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bitoPayloadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload" },
      { status: 400 }
    );
  }

  const { title, body, journal, tags } = parsed.data;
  const id = crypto.randomUUID();
  const slug = generateSlug(title, id);
  const readTime = estimateReadTime(body);

  const { error } = await supabase.from("notebook_entries").insert({
    id,
    slug,
    journal,
    title: title ?? null,
    body_html: body,
    read_time_minutes: readTime,
    source: "bito",
    status: "staged",
    tags,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update last_bito_webhook_at
  await supabase
    .from("site_settings")
    .update({ last_bito_webhook_at: new Date().toISOString() })
    .not("id", "is", null);

  return NextResponse.json({ ok: true, id }, { status: 201 });
}

// Reject non-POST methods
export function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
