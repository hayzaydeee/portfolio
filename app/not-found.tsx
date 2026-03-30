import Link from "next/link";
import { HzyMark } from "@/components/nav/HzyMark";

// ── Static faded polaroids ─────────────────────────────────────────────────────

const POLAROIDS = [
  { label: "vrrbose", rotate: "-3deg", left: "12%", top: "38%", delay: "0s" },
  { label: "/wall", rotate: "5deg", left: "68%", top: "30%", delay: "0.2s" },
  { label: "bito.works", rotate: "-1deg", left: "40%", top: "62%", delay: "0.4s" },
];

export default function NotFound() {
  return (
    <div
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden"
      style={{ background: "#0D1209" }}
    >
      {/* Polaroids */}
      {POLAROIDS.map((p) => (
        <div
          key={p.label}
          className="absolute pointer-events-none select-none"
          style={{
            left: p.left,
            top: p.top,
            transform: `rotate(${p.rotate})`,
            opacity: 0.12,
            animationDelay: p.delay,
          }}
        >
          <div
            className="w-28 bg-white/90 shadow-lg"
            style={{ padding: "8px 8px 28px" }}
          >
            <div
              className="w-full aspect-square"
              style={{ background: "#c8c4bc" }}
            />
            <p
              className="mt-1 text-center font-mono text-[9px] text-black/50"
              style={{ lineHeight: 1.3 }}
            >
              {p.label}
            </p>
          </div>
        </div>
      ))}

      {/* Bare lightbulb */}
      <div className="mb-10">
        <svg
          width="40"
          height="56"
          viewBox="0 0 40 56"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          style={{ animation: "flicker 4s ease-in-out infinite" }}
        >
          {/* socket cap */}
          <rect x="13" y="0" width="14" height="4" rx="2" fill="#334" />
          {/* socket threads */}
          <rect x="12" y="5" width="16" height="3" rx="1" fill="#556" />
          <rect x="12" y="9" width="16" height="3" rx="1" fill="#556" />
          {/* glass bulb */}
          <path
            d="M20 14C11.163 14 4 21.163 4 30C4 36.627 7.918 42.29 13.5 44.95V48H26.5V44.95C32.082 42.29 36 36.627 36 30C36 21.163 28.837 14 20 14Z"
            fill="#C6C2B4"
            fillOpacity="0.25"
            stroke="#C6C2B4"
            strokeOpacity="0.4"
            strokeWidth="1"
          />
          {/* filament */}
          <path
            d="M16 36 L18 28 L20 32 L22 24 L24 36"
            stroke="#E8D86A"
            strokeOpacity="0.7"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          {/* base collar */}
          <rect x="13" y="48" width="14" height="8" rx="2" fill="#334" />
        </svg>
      </div>

      {/* Main text */}
      <p
        className="font-mono text-sm text-center px-6"
        style={{ color: "#7A8A76" }}
      >
        this room doesn&apos;t exist yet.
      </p>

      {/* Home link */}
      <Link
        href="/"
        className="mt-12 transition-opacity hover:opacity-80"
        aria-label="back to lobby"
        style={{ opacity: 0.35 }}
      >
        <HzyMark mode="dark" size={28} />
      </Link>

      {/* Flicker keyframe */}
      <style>{`
        @keyframes flicker {
          0%,  100% { opacity: 0.55; }
          20%        { opacity: 0.50; }
          25%        { opacity: 0.20; }
          26%        { opacity: 0.55; }
          60%        { opacity: 0.50; }
          61%        { opacity: 0.35; }
          62%        { opacity: 0.55; }
        }
      `}</style>
    </div>
  );
}
