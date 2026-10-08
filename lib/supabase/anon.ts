import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cookie-less anon client for public reads that row-level security already scopes to
 * published rows. Reading no cookies keeps a route static: it can run in
 * generateStaticParams at build time, and render a page that wasn't prebuilt on demand
 * without Next refusing it as a static page turned dynamic.
 */
export function createAnonClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
