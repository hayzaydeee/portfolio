"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { cn } from "@/lib/utils";

type Node = {
  side: "left" | "right";
  label: string;
  sub: string;
  date: string;
};

const NODES: Node[] = [
  {
    side: "left",
    label: "University of Northampton",
    sub: "BSc Software Engineering",
    date: "2023 —",
  },
  {
    side: "right",
    label: "Freelance projects",
    sub: "vrrbose, bito.works, others",
    date: "2022 —",
  },
];

// The trunk SVG path — a simple straight vertical line from bottom to top
const TRUNK_PATH = "M 60 280 C 60 200 60 120 60 40";

export function Seedling() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  // trunk grows from 0 → full path length as user scrolls in
  const pathLength = useTransform(scrollYProgress, [0.1, 0.6], [0, 1]);

  return (
    <section
      ref={ref}
      className="relative bg-(--lobby-surface) py-20 px-6"
    >
      <div className="max-w-5xl mx-auto">
        {/* Desktop: SVG tree */}
        <div className="hidden md:block relative h-85">
          <svg
            viewBox="0 0 120 300"
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
              style={{ pathLength }}
              strokeLinecap="round"
            />
          </svg>

          {/* Nodes positioned around the trunk */}
          {NODES.map((node, i) => {
            const y = 80 + i * 100; // vertical spacing
            const isLeft = node.side === "left";
            return (
              <motion.div
                key={node.label}
                initial={{ opacity: 0, x: isLeft ? 20 : -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ delay: i * 0.15, duration: 0.4, ease: "easeOut" }}
                className={cn(
                  "absolute text-sm font-sans",
                  isLeft
                    ? "right-[calc(50%+28px)] text-right"
                    : "left-[calc(50%+28px)] text-left"
                )}
                style={{ top: `${y}px` }}
              >
                <div className="text-(--lobby-text) font-sans">{node.label}</div>
                <div className="text-(--color-text-muted) text-xs mt-0.5">{node.sub}</div>
                <div className="text-(--color-accent-muted) text-xs mt-0.5">{node.date}</div>
              </motion.div>
            );
          })}
        </div>

        {/* Mobile: vertical timeline */}
        <div className="md:hidden flex flex-col gap-8 pl-6 border-l-2 border-(--color-accent-muted)">
          {NODES.map((node, i) => (
            <motion.div
              key={node.label}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.35 }}
              className="relative"
            >
              {/* dot */}
              <span className="absolute -left-6.25 top-1 w-2.5 h-2.5 rounded-full bg-(--color-accent) border-2 border-(--lobby-surface)" />
              <div className="text-sm font-sans text-(--lobby-text)">{node.label}</div>
              <div className="text-xs text-(--color-text-muted) mt-0.5">{node.sub}</div>
              <div className="text-xs text-(--color-accent-muted) mt-0.5">{node.date}</div>
            </motion.div>
          ))}
        </div>

        {/* Still growing anchor */}
        <p className="mt-12 text-sm font-sans text-(--color-accent-muted) text-center tracking-wide">
         still growing.
        </p>
      </div>
    </section>
  );
}
