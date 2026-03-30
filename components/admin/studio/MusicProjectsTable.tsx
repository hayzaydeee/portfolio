import Link from "next/link";
import { StatusBadge } from "@/components/admin/StatusBadge";
import type { MusicProject } from "@/app/actions/studio";

type MusicProjectsTableProps = {
  projects: MusicProject[];
};

export function MusicProjectsTable({ projects }: MusicProjectsTableProps) {
  if (projects.length === 0) {
    return (
      <div className="bg-white border border-black/10 rounded-xl px-6 py-12 text-center">
        <p className="text-sm text-text-muted">no music projects yet</p>
        <p className="text-xs text-text-muted mt-1">
          Add your first project to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-black/10 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-black/8 bg-black/2">
            <th className="text-left px-4 py-3 text-xs font-medium text-text-muted">Project</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-text-muted">Year</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-text-muted">Tracks</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-text-muted">Status</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-text-muted">Flags</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-black/5">
          {projects.map((p) => (
            <tr key={p.id} className="hover:bg-black/2 transition-colors">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  {p.artwork_path ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.artwork_path}
                      alt={p.title}
                      className="w-9 h-9 rounded object-cover border border-black/8 shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded border border-black/8 bg-black/5 shrink-0" />
                  )}
                  <div>
                    <p className="font-medium text-base-dark">{p.title}</p>
                    <p className="text-xs text-text-muted font-mono">{p.slug}</p>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-text-muted">
                {p.release_year ?? <span className="opacity-40">—</span>}
              </td>
              <td className="px-4 py-3 text-text-muted">
                {p.tracks?.length ?? 0}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={p.status} />
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-1.5">
                  {p.is_featured && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-accent/10 text-accent">
                      featured
                    </span>
                  )}
                  {p.is_wip && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-(--admin-accent-studio)/10 text-(--admin-accent-studio)">
                      WIP
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/admin/studio/${p.id}`}
                  className="text-xs text-accent hover:underline"
                >
                  Edit →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
