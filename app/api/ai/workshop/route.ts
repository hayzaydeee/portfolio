import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { createWorkshopStream, type AIPromptName } from "@/lib/ai";

// ── Rate limiters ───────────────────────────────────────────────────────────────

function makeRateLimiters() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  return {
    perSession: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "1 h"),
      prefix: "rl:workshop:session",
    }),
    perIP: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, "1 h"),
      prefix: "rl:workshop:ip",
    }),
  };
}

const limiters = makeRateLimiters();

// ── Input validation ────────────────────────────────────────────────────────────

const MAX_QUERY_LENGTH = 500;
// Strip control characters except tab, newline, carriage return
const CONTROL_CHAR_REGEX = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

function sanitizeQuery(raw: string): string {
  return raw.replace(CONTROL_CHAR_REGEX, "").trim();
}

// ── Route handler ───────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query: rawQuery, variant } = body as {
      query: unknown;
      variant: unknown;
    };

    if (typeof rawQuery !== "string" || !rawQuery.trim()) {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    const query = sanitizeQuery(rawQuery);
    if (query.length === 0) {
      return NextResponse.json({ error: "query is empty after sanitization" }, { status: 400 });
    }
    if (query.length > MAX_QUERY_LENGTH) {
      return NextResponse.json(
        { error: `query too long (max ${MAX_QUERY_LENGTH} chars)` },
        { status: 400 }
      );
    }

    const promptName: AIPromptName =
      variant === "life-log" ? "life-log" : "workshop";

    // ── Rate limiting ───────────────────────────────────────────────────────────
    if (limiters) {
      const ip =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        req.headers.get("x-real-ip") ??
        "anonymous";

      const sessionId =
        req.cookies.get("next-auth.session-token")?.value ??
        req.cookies.get("__Secure-next-auth.session-token")?.value ??
        ip; // fall back to IP as session key

      const [ipResult, sessionResult] = await Promise.all([
        limiters.perIP.limit(ip),
        limiters.perSession.limit(sessionId),
      ]);

      if (!ipResult.success) {
        return NextResponse.json(
          { error: "too many requests from this address" },
          {
            status: 429,
            headers: { "Retry-After": String(Math.floor(ipResult.reset / 1000)) },
          }
        );
      }
      if (!sessionResult.success) {
        return NextResponse.json(
          { error: "rate limit reached — try again in an hour" },
          {
            status: 429,
            headers: { "Retry-After": String(Math.floor(sessionResult.reset / 1000)) },
          }
        );
      }
    }

    // ── Stream ──────────────────────────────────────────────────────────────────
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "AI terminal not configured" },
        { status: 503 }
      );
    }

    const stream = createWorkshopStream(query, promptName);

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch {
    return NextResponse.json({ error: "internal server error" }, { status: 500 });
  }
}
