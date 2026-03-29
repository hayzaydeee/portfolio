import { auth } from "@/auth";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

async function getStats() {
  try {
    const supabase = await createClient();

    const [projects, entries, wall, tracks, staged] = await Promise.all([
      supabase.from("projects").select("id", { count: "exact" }).eq("status", "published"),
      supabase.from("notebook_entries").select("id", { count: "exact" }).eq("status", "published"),
      supabase.from("wall_pieces").select("id", { count: "exact" }).eq("status", "published"),
      supabase.from("tracks").select("id", { count: "exact" }),
      supabase.from("notebook_entries").select("id", { count: "exact" }).eq("status", "staged"),
    ]);

    return {
      projects: projects.count ?? 0,
      entries: entries.count ?? 0,
      wall: wall.count ?? 0,
      tracks: tracks.count ?? 0,
      staged: staged.count ?? 0,
    };
  } catch {
    return { projects: 0, entries: 0, wall: 0, tracks: 0, staged: 0 };
  }
}

export default async function AdminOverview() {
  const [session, stats] = await Promise.all([auth(), getStats()]);

  const statCards = [
    { label: "projects", value: stats.projects, href: "/admin/workshop" },
    { label: "notebook entries", value: stats.entries, href: "/admin/notebook" },
    { label: "wall pieces", value: stats.wall, href: "/admin/wall" },
    { label: "tracks", value: stats.tracks, href: "/admin/studio" },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-sans text-(--lobby-text)">overview</h1>
        <p className="text-sm font-sans text-(--color-text-muted) mt-1">
          welcome back, {session?.user?.name?.split(" ")[0] ?? "Divine"}
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {statCards.map(({ label, value, href }) => (
          <Link
            key={label}
            href={href}
            className="rounded-xl border border-black/10 p-4 bg-white hover:border-black/20 transition-colors group"
          >
            <div className="text-2xl font-sans text-(--color-base-dark)">{value}</div>
            <div className="text-xs font-sans text-(--color-text-muted) mt-1">{label}</div>
          </Link>
        ))}
      </div>

      {/* Pending items */}
      {stats.staged > 0 && (
        <Link
          href="/admin/notebook"
          className="flex items-center gap-3 rounded-xl border border-[#B87A00]/20 bg-[#B87A00]/5 px-5 py-4 mb-6 hover:border-[#B87A00]/30 transition-colors"
        >
          <span className="text-sm text-[#B87A00]">
            {stats.staged} staged {stats.staged === 1 ? "entry" : "entries"} awaiting review →
          </span>
        </Link>
      )}

      {/* Shortcuts */}
      <div className="rounded-xl border border-black/10 p-6 bg-white">
        <h2 className="text-sm font-sans text-(--color-base-dark) mb-4">shortcuts</h2>
        <div className="flex flex-col gap-2">
          {[
            { href: "/admin/workshop", label: "manage projects →" },
            { href: "/admin/notebook", label: "write or review entries →" },
            { href: "/admin/studio", label: "update music →" },
            { href: "/admin/settings", label: "settings →" },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-sm font-sans text-(--color-text-muted) hover:text-(--color-base-dark) transition-colors"
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

