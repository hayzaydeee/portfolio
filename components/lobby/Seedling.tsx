"use client";

import { useEffect, useRef } from "react";
import { motion, useMotionValueEvent, useTransform } from "motion/react";
import { cn } from "@/lib/utils";
import { FxStage, type FxHandle } from "@/components/fx/FxStage";
import type { TreeAnchors } from "@/components/fx/effects/generative-tree/renderer";
import { SectionHeading } from "./SectionHeading";
import { useSectionProgress, type LobbyMode } from "./sectionProgress";

type Node = {
  side: "left" | "right";
  label: string;
  sub: string;
  date: string;
};

const NODES: Node[] = [
  {
    side: "left",
    label: "first contact",
    sub: "prototyping with Justinmind. won a prize at a teen coding convention. didn’t know it yet, but this was it.",
    date: "2017",
  },
  {
    side: "right",
    label: "first real code",
    sub: "Angela Yu’s web dev bootcamp. HTML, CSS, JS. built the first few things. understood nothing and everything.",
    date: "2020",
  },
  {
    side: "left",
    label: "Northampton",
    sub: "BSc Software Engineering, University of Northampton. the formal chapter begins.",
    date: "2024",
  },
  {
    side: "right",
    label: "predictionsLeague",
    sub: "first full product shipped. sports prediction platform, built from scratch.",
    date: "2025 · March",
  },
  {
    side: "left",
    label: "bito.works",
    sub: "habit tracking with an AI layer. first time building something people actually use daily.",
    date: "2025 · May",
  },
  {
    side: "right",
    label: "gaff3r",
    sub: "AI football analyst on Cloudflare’s edge. live match data, Llama 3.3, prediction tracking.",
    date: "2026",
  },
  {
    side: "left",
    label: "vrrbose",
    sub: "developer activity daemon with MCP gateway. the most technically ambitious thing built so far.",
    date: "2026",
  },
];

/** Label heights, earliest lowest: each sits by a tip one generation further up the tree */
const LABEL_Y = [0.84, 0.72, 0.6, 0.48, 0.36, 0.24, 0.12];
const LABEL_TOP = ["top-[84%]", "top-[72%]", "top-[60%]", "top-[48%]", "top-[36%]", "top-[24%]", "top-[12%]"];
const TARGETS = NODES.map((n, i) => ({ side: n.side, y: LABEL_Y[i] }));
/** Label column width (w-56) plus the gap before its leader line starts */
const COLUMN_PX = 232;

/** A milestone in its side column; a leader line runs from it to its branch tip */
function TipLabel({ node, index, ref }: { node: Node; index: number; ref: (el: HTMLDivElement | null) => void }) {
  const isLeft = node.side === "left";
  return (
    <div
      ref={ref}
      className={cn(
        "absolute w-56 -translate-y-1/2 rounded-md bg-(--lobby-surface)/70 px-2.5 py-1.5 font-sans text-sm opacity-0 backdrop-blur-sm",
        LABEL_TOP[index],
        isLeft ? "left-0 text-right" : "right-0 text-left"
      )}
      data-seedling-tip={node.label}
    >
      <div className="text-(--lobby-text)">{node.label}</div>
      <div className="mt-0.5 text-xs text-text-muted">{node.sub}</div>
      <div className="mt-0.5 text-xs text-accent-muted">{node.date}</div>
    </div>
  );
}

export function Seedling({ mode = "resting" }: { mode?: LobbyMode }) {
  const isSequence = mode === "sequence";
  const ref = useRef<HTMLElement>(null);
  const tree = useRef<FxHandle>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const labels = useRef<(HTMLDivElement | null)[]>([]);
  const leaders = useRef<(SVGLineElement | null)[]>([]);
  const dots = useRef<(SVGCircleElement | null)[]>([]);

  const progress = useSectionProgress(mode, ref, { offset: ["start end", "end start"], duration: 6, delay: 0.3 });
  // Resting: the tree grows while the section crosses the middle of the screen
  const growth = useTransform(progress, isSequence ? [0, 1] : [0.12, 0.62], [0, 1]);

  // Growth reaches the renderer as a command, never a React render
  useMotionValueEvent(growth, "change", (v) => tree.current?.command("progress", v));
  useEffect(() => {
    tree.current?.command("progress", growth.get());

    // Leaders follow the tips; a milestone shows once its branch has mostly grown. Writes go
    // straight to the elements every frame, never through React state
    const anchors: TreeAnchors = {
      targets: TARGETS,
      onFrame: (pts) => {
        const width = stageRef.current?.clientWidth ?? 0;
        const height = stageRef.current?.clientHeight ?? 0;
        NODES.forEach((node, i) => {
          const shown = Math.min(1, Math.max(0, (pts[i * 3 + 2] - 0.7) / 0.3)).toFixed(3);
          const line = leaders.current[i];
          const dot = dots.current[i];
          const label = labels.current[i];
          if (label) label.style.opacity = shown;
          if (!line || !dot) return;
          const x = pts[i * 3].toFixed(1);
          const y = pts[i * 3 + 1].toFixed(1);
          line.setAttribute("x1", String(node.side === "left" ? COLUMN_PX : width - COLUMN_PX));
          line.setAttribute("y1", (LABEL_Y[i] * height).toFixed(1));
          line.setAttribute("x2", x);
          line.setAttribute("y2", y);
          line.style.opacity = shown;
          dot.setAttribute("cx", x);
          dot.setAttribute("cy", y);
          dot.style.opacity = shown;
        });
      },
    };
    tree.current?.command("anchors", anchors);
  }, [growth]);

  return (
    <section ref={ref} className={`relative px-6 ${isSequence ? "flex min-h-screen items-center justify-center" : "py-20"}`}>
      <div className="mx-auto w-full max-w-5xl">
        <SectionHeading>THE SEEDLING</SectionHeading>

        <div ref={stageRef} className="relative h-80 md:h-165" data-seedling-tree="">
          <FxStage slot="lobby.seedling" handle={tree} className="absolute inset-0" posterClassName="bg-transparent" />

          {/* Desktop: each milestone in a side column, a leader line out to its branch */}
          <div className="absolute inset-0 hidden md:block">
            <svg className="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden="true">
              {NODES.map((node, i) => (
                <g key={node.label}>
                  <line
                    ref={(el) => {
                      leaders.current[i] = el;
                    }}
                    className="stroke-(--lobby-accent) opacity-0"
                    strokeWidth={1}
                    strokeDasharray="2 4"
                  />
                  <circle
                    ref={(el) => {
                      dots.current[i] = el;
                    }}
                    r={3}
                    className="fill-(--lobby-accent) opacity-0"
                  />
                </g>
              ))}
            </svg>
            {NODES.map((node, i) => (
              <TipLabel
                key={node.label}
                node={node}
                index={i}
                ref={(el) => {
                  labels.current[i] = el;
                }}
              />
            ))}
          </div>
        </div>

        {/* Mobile: vertical timeline under the tree */}
        <div className="mt-8 flex flex-col gap-8 border-l-2 border-accent-muted pl-6 md:hidden">
          {NODES.map((node, i) => (
            <motion.div
              key={node.label}
              initial={{ opacity: 0, y: 10 }}
              {...(isSequence
                ? { animate: { opacity: 1, y: 0 }, transition: { delay: 0.2 + i * 0.15, duration: 0.35 } }
                : { whileInView: { opacity: 1, y: 0 }, viewport: { once: true }, transition: { delay: i * 0.1, duration: 0.35 } })}
              className="relative"
            >
              <span className="absolute -left-6.25 top-1 size-2.5 rounded-full border-2 border-(--lobby-surface) bg-accent" />
              <div className="font-sans text-sm text-(--lobby-text)">{node.label}</div>
              <div className="mt-0.5 text-xs text-text-muted">{node.sub}</div>
              <div className="mt-0.5 text-xs text-accent-muted">{node.date}</div>
            </motion.div>
          ))}
        </div>

        <p className="mt-12 text-center font-sans text-sm tracking-wide text-accent-muted">still growing.</p>
      </div>
    </section>
  );
}
