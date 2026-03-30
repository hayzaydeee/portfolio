import Link from "next/link";
import { StatusBadge } from "@/components/admin/StatusBadge";
import type { AnalysisEssay } from "@/app/actions/studio";

type AnalysisEssaysTableProps = {
  essays: AnalysisEssay[];
};

export function AnalysisEssaysTable({ essays }: AnalysisEssaysTableProps) {
  if (essays.length === 0) {
    return (
      <div className="bg-white border border-black/10 rounded-xl px-6 py-12 text-center">
        <p className="text-sm text-text-muted">no analysis essays yet</p>
        <p className="text-xs text-text-muted mt-1">
          Add your first essay to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-black/10 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-black/8 bg-black/2">
            <th className="text-left px-4 py-3 text-xs font-medium text-text-muted">Title</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-text-muted">Subject</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-text-muted">Read time</th>
            <th className="text-left px-4 py-3 text-xs font-medium text-text-muted">Status</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-black/5">
          {essays.map((e) => (
            <tr key={e.id} className="hover:bg-black/2 transition-colors">
              <td className="px-4 py-3">
                <p className="font-medium text-base-dark">{e.title}</p>
                <p className="text-xs text-text-muted font-mono">{e.slug}</p>
              </td>
              <td className="px-4 py-3 text-text-muted">{e.subject}</td>
              <td className="px-4 py-3 text-text-muted">
                {e.read_time_minutes != null ? (
                  `${e.read_time_minutes} min`
                ) : (
                  <span className="opacity-40">—</span>
                )}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={e.status} />
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/admin/studio/essays/${e.id}`}
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
