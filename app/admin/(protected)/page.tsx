import { auth } from "@/auth";

export default async function AdminOverview() {
  const session = await auth();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-sans text-(--color-base-dark)">overview</h1>
        <p className="text-sm font-sans text-(--color-text-muted) mt-1">
          welcome back, {session?.user?.name?.split(" ")[0] ?? "Divine"}
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "projects", value: "—" },
          { label: "notebook entries", value: "—" },
          { label: "wall pieces", value: "—" },
          { label: "tracks", value: "—" },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-xl border border-black/10 p-4 bg-white"
          >
            <div className="text-2xl font-sans text-(--color-base-dark)">{value}</div>
            <div className="text-xs font-sans text-(--color-text-muted) mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Pending / shortcuts */}
      <div className="rounded-xl border border-black/10 p-6 bg-white">
        <h2 className="text-sm font-sans text-(--color-base-dark) mb-4">shortcuts</h2>
        <div className="flex flex-col gap-2">
          {[
            { href: "/admin/(protected)/workshop", label: "manage projects →" },
            { href: "/admin/(protected)/notebook", label: "write or review entries →" },
            { href: "/admin/(protected)/studio", label: "update music →" },
            { href: "/admin/(protected)/settings", label: "update currently →" },
          ].map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className="text-sm font-sans text-(--color-text-muted) hover:text-(--color-accent) transition-colors"
            >
              {label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
