"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { cn } from "@/lib/utils";
import { SectionHeading } from "./SectionHeading";

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
    sub: "prototyping with Justinmind. won a prize at a teen coding convention. didn\u2019t know it yet, but this was it.",
    date: "2017",
  },
  {
    side: "right",
    label: "first real code",
    sub: "Angela Yu\u2019s web dev bootcamp. HTML, CSS, JS. built the first few things. understood nothing and everything.",
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
    date: "2025 \u2014 March",
  },
  {
    side: "left",
    label: "bito.works",
    sub: "habit tracking with an AI layer. first time building something people actually use daily.",
    date: "2025 \u2014 May",
  },
  {
    side: "right",
    label: "gaff3r",
    sub: "AI football analyst on Cloudflare\u2019s edge. live match data, Llama 3.3, prediction tracking.",
    date: "2026",
  },
  {
    side: "left",
    label: "vrrbose",
    sub: "developer activity daemon with MCP gateway. the most technically ambitious thing built so far.",
    date: "2026",
  },
];

// Trunk SVG path — extended for 7 nodes
const TRUNK_PATH = "M 60 620 C 60 520 60 420 60 320 C 60 220 60 120 60 40";

export function Seedling({ mode = "resting" }: { mode?: "sequence" | "resting" }) {
  const isSequence = mode === "sequence";
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const pathLength = useTransform(scrollYProgress, [0.1, 0.6], [0, 1]);

  return (
    <section
      ref={ref}
      className={`relative bg-(--lobby-surface) px-6 ${
        isSequence ? "min-h-screen flex items-center justify-center" : "py-20"
      }`}
    >
      <div className="max-w-5xl mx-auto">
        <SectionHeading>THE SEEDLING</SectionHeading>

        {/* Desktop: SVG tree */}
        <div className="hidden md:block relative" style={{ height: isSequence ? 660 : 660 }}>
          <svg
            viewBox="0 0 120 640"
            className="absolute left-1/2 -translate-x-1/2 h-full"
            overflow="visible"
            aria-hidden="true"
          >
            {/* Trunk */}
            <motion.path
              d={TRUNK_PATH}
              stroke="var(--color-accent)"
              strokeWidth="2"
              fill="none"
              style={isSequence ? undefined : { pathLength }}
              initial={isSequence ? { pathLength: 0 } : undefined}
              animate={isSequence ? { pathLength: 1 } : undefined}
              transition={isSequence ? { duration: 1.5, ease: "easeOut" } : undefined}
              strokeLinecap="round"
            />
          </svg>

          {/* Nodes positioned around the trunk */}
          {NODES.map((node, i) => {
            const y = 40 + i * 88;
            const isLeft = node.side === "left";
            return (
              <motion.div
                key={node.label}
                initial={{ opacity: 0, x: isLeft ? 20 : -20 }}
                {...(isSequence
                  ? {
                      animate: { opacity: 1, x: 0 },
                      transition: { delay: 0.3 + i * 0.2, duration: 0.4, ease: "easeOut" },
                    }
                  : {
                      whileInView: { opacity: 1, x: 0 },
                      viewport: { once: true, margin: "-60px" },
                      transition: { delay: i * 0.15, duration: 0.4, ease: "easeOut" },
                    })}
                className={cn(
                  "absolute text-sm font-sans max-w-56",
                  isLeft
                    ? "right-[calc(50%+28px)] text-right"
                    : "left-[calc(50%+28px)] text-left"
                )}
                style={{ top: `${y}px` }}
              >
                <div className="text-(--lobby-text) font-sans">{node.label}</div>
                <div className="text-text-muted text-xs mt-0.5">{node.sub}</div>
                <div className="text-accent-muted text-xs mt-0.5">{node.date}</div>
              </motion.div>
            );
          })}
        </div>

        {/* Mobile: vertical timeline */}
        <div className="md:hidden flex flex-col gap-8 pl-6 border-l-2 border-accent-muted">
          {NODES.map((node, i) => (
            <motion.div
              key={node.label}
              initial={{ opacity: 0, y: 10 }}
              {...(isSequence
                ? {
                    animate: { opacity: 1, y: 0 },
                    transition: { delay: 0.2 + i * 0.15, duration: 0.35 },
                  }
                : {
                    whileInView: { opacity: 1, y: 0 },
                    viewport: { once: true },
                    transition: { delay: i * 0.1, duration: 0.35 },
                  })}
              className="relative"
            >
              <span className="absolute -left-6.25 top-1 w-2.5 h-2.5 rounded-full bg-accent border-2 border-(--lobby-surface)" />
              <div className="text-sm font-sans text-(--lobby-text)">{node.label}</div>
              <div className="text-xs text-text-muted mt-0.5">{node.sub}</div>
              <div className="text-xs text-accent-muted mt-0.5">{node.date}</div>
            </motion.div>
          ))}
        </div>

        {/* Still growing anchor */}
        <p className="mt-12 text-sm font-sans text-accent-muted text-center tracking-wide">
         still growing.
        </p>
      </div>
    </section>
  );
}
