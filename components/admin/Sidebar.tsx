import { HzyMark } from "@/components/nav/HzyMark";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { QuickEditCurrently } from "@/components/admin/QuickEditCurrently";
import type { Currently } from "@/lib/data/currently";

const SECTIONS = [
  { href: "/admin", label: "overview", accent: "var(--admin-accent-overview)" },
  { href: "/admin/workshop", label: "workshop", accent: "var(--admin-accent-workshop)" },
  { href: "/admin/studio", label: "studio", accent: "var(--admin-accent-studio)" },
  { href: "/admin/notebook", label: "notebook", accent: "var(--admin-accent-notebook)" },
  { href: "/admin/wall", label: "wall", accent: "var(--admin-accent-wall)" },
  { href: "/admin/settings", label: "settings", accent: "#555" },
] as const;

interface AdminSidebarProps {
  active: string;
  current: Currently | null;
}

export function AdminSidebar({ active, current }: AdminSidebarProps) {
  return (
    <aside className="w-55 shrink-0 border-r border-black/10 flex flex-col h-full bg-(--lobby-surface-deep)">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-8">
        <HzyMark mode="light" size={22} />
        <span className="text-sm font-sans text-(--color-text-muted)">admin</span>
      </div>

      {/* Nav items */}
      <nav className="flex flex-col gap-0.5 px-3 flex-1">
        {SECTIONS.map(({ href, label, accent }) => {
          const isActive = active === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-sans transition-colors",
                isActive
                  ? "bg-white text-(--color-base-dark) shadow-sm"
                  : "text-(--color-text-muted) hover:bg-white/60 hover:text-(--color-base-dark)"
              )}
            >
              {/* Room accent dot */}
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: accent }}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Currently quick-edit widget */}
      <div className="px-4 py-5 border-t border-white/8">
        <p className="text-[10px] font-sans text-(--color-text-muted) mb-2.5 uppercase tracking-wider">now</p>
        <QuickEditCurrently current={current} />
      </div>
    </aside>
  );
}
