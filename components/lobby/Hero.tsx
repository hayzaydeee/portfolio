import Link from "next/link";

const ROOM_LINKS = [
  { href: "/work", label: "work" },
  { href: "/music", label: "music" },
  { href: "/notebook", label: "notebook" },
  { href: "/wall", label: "wall" },
] as const;

// Ambient fragments for desktop background layer
function AmbientLayer() {
  return (
    <div
      aria-hidden="true"
      className="hidden md:block absolute inset-0 overflow-hidden pointer-events-none select-none"
    >
      {/* Workshop file tree fragment */}
      <div
        className="absolute right-[12%] top-[18%] font-mono text-[11px] text-(--lobby-text) leading-5"
        style={{ opacity: 0.12 }}
      >
        {["src/", "  lib/", "    utils.ts", "  components/", "    Nav.tsx"].map((line) => (
          <div key={line}>{line}</div>
        ))}
      </div>
      {/* Notebook serif fragment */}
      <div
        className="absolute right-[8%] bottom-[30%] font-serif text-sm max-w-45 italic text-(--lobby-text) leading-6"
        style={{ opacity: 0.13 }}
      >
        the light that makes sight possible is not itself always seen
      </div>
      {/* Waveform sliver */}
      <svg
        width="120"
        height="36"
        viewBox="0 0 120 36"
        className="absolute right-[20%] bottom-[20%]"
        style={{ opacity: 0.07 }}
        aria-hidden="true"
      >
        {Array.from({ length: 30 }, (_, i) => {
          const h = 4 + Math.sin(i * 0.7) * 12 + Math.sin(i * 1.3) * 8;
          return (
            <rect
              key={i}
              x={i * 4}
              y={(36 - h) / 2}
              width="2.5"
              height={h}
              rx="1.25"
              fill="var(--lobby-text)"
            />
          );
        })}
      </svg>
      {/* Polaroid edge */}
      <div
        className="absolute right-[5%] top-[35%] w-24 h-28 border border-(--lobby-text) rounded-sm"
        style={{ opacity: 0.1 }}
      />
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative min-h-[calc(100vh-3.5rem)] flex items-center overflow-hidden bg-(--lobby-surface)">
      <AmbientLayer />

      <div className="relative z-10 max-w-5xl mx-auto w-full px-6 py-20">
        {/* Identity anchor */}
        <h1 className="text-5xl md:text-7xl font-sans text-(--lobby-text) tracking-tight mb-3">
          Divine Eze
        </h1>
        <p className="text-base md:text-lg font-sans text-(--color-text-muted) mb-10">
          software engineer. musician. writer.
        </p>

        {/* Room nav links */}
        <nav aria-label="room navigation">
          <ul className="flex flex-col md:flex-row gap-3 md:gap-8 list-none m-0 p-0">
            {ROOM_LINKS.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="text-base font-sans text-(--color-text-muted) hover:text-(--lobby-text) hover:underline hover:decoration-(--lobby-accent) underline-offset-4 transition-colors"
               >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </section>
  );
}
