import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cookie-less service-role client for server-side reads that must not opt the route
 * into dynamic rendering and must never reach the browser. Select narrow columns only.
 */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
