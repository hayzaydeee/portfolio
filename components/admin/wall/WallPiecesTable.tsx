import Link from "next/link";
import { StatusBadge } from "@/components/admin/StatusBadge";
import type { WallPiece } from "@/app/actions/wall";

const TYPE_LABEL: Record<WallPiece["type"], string> = {
  art: "Art",
  video_short: "Video (short)",
  video_long: "Video (long)",
};

const TYPE_ICON: Record<WallPiece["type"], string> = {
  art: "🎨",
  video_short: "▶",
  video_long: "▶▶",
};

type WallPiecesTableProps = {
  pieces: WallPiece[];
};

export function WallPiecesTable({ pieces }: WallPiecesTableProps) {
  if (pieces.length === 0) {
    return (
      <div className="bg-white border border-black/10 rounded-xl px-6 py-12 text-center">
        <p className="text-sm text-text-muted">no wall pieces yet</p>
        <p className="text-xs text-text-muted mt-1">
          Add your first piece to populate the wall.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-black/10 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-black/8 bg-black/2">
            <th className="text-left px-4 py-3 text-xs font-medium text-text-muted">Preview</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-text-muted">Caption</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-text-muted">Type</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-text-muted">Status</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-text-muted">Date</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-black/5">
          {pieces.map((p) => (
            <tr key={p.id} className="hover:bg-black/2 transition-colors">
              <td className="px-4 py-3">
                {p.image_path ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.image_path}
                    alt={p.alt_text ?? p.caption ?? "Wall piece"}
                    className="w-12 h-12 rounded object-cover border border-black/8 shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded border border-black/8 bg-black/5 flex items-center justify-center shrink-0">
                    <span className="text-lg opacity-40">{TYPE_ICON[p.type]}</span>
                  </div>
                )}
              </td>
              <td className="px-4 py-3">
                <p className="text-base-dark">
                  {p.caption ?? <span className="text-text-muted opacity-60">—</span>}
                </p>
                {p.youtube_url && (
                  <p className="text-xs text-text-muted font-mono truncate max-w-52">
                    {p.youtube_url}
                  </p>
                )}
              </td>
              <td className="px-4 py-3 text-text-muted whitespace-nowrap">
                {TYPE_LABEL[p.type]}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={p.status} />
              </td>
              <td className="px-4 py-3 text-text-muted text-xs whitespace-nowrap">
                {new Date(p.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
                {p.publish_at && p.status === "scheduled" && (
                  <p className="text-(--admin-status-scheduled) text-xs mt-0.5">
                    ↪ {new Date(p.publish_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/admin/wall/${p.id}`}
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
