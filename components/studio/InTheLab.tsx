"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import type { MusicProject } from "@/app/actions/studio";

type Props = {
  projects: MusicProject[];
};

type LabModal = {
  title: string;
  description: string | null;
};

export function InTheLab({ projects }: Props) {
  const [modal, setModal] = useState<LabModal | null>(null);

  if (!projects.length) return null;

  return (
    <section className="max-w-6xl mx-auto px-6 pb-16">
      <div
        className="pt-8 mb-6"
        style={{ borderTop: "1px solid var(--studio-border)" }}
      >
        <p
          className="text-xs font-mono uppercase tracking-widest"
          style={{ color: "var(--studio-text-muted)", letterSpacing: "0.15em" }}
        >
          in the lab
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {projects.map((p) => (
          <motion.div
            key={p.id}
            className="rounded-xl overflow-hidden cursor-pointer"
            style={{
              background: "var(--studio-panel)",
              border: "1px solid var(--studio-border)",
              opacity: 0.75,
            }}
            whileHover={{ opacity: 1 }}
            onClick={() =>
              setModal({ title: p.title, description: p.description })
            }
          >
            {/* Artwork with WIP badge */}
            <div className="relative" style={{ aspectRatio: "1 / 1" }}>
              {p.artwork_path ? (
                <Image
                  src={p.artwork_path}
                  alt={p.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, 25vw"
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{ background: "var(--studio-raised)" }}
                >
                  <span className="text-4xl opacity-20">♪</span>
                </div>
              )}
              {/* WIP label */}
              <span
                className="absolute top-2 right-2 text-[10px] font-mono px-1.5 py-0.5 rounded"
                style={{ background: "var(--studio-accent-light)", color: "var(--studio-text)" }}
              >
                WIP
              </span>
            </div>
            <div className="p-3">
              <p className="text-sm truncate" style={{ color: "var(--studio-text)" }}>
                {p.title}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* WIP modal */}
      <AnimatePresence>
        {modal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setModal(null)}
          >
            <div
              className="absolute inset-0"
              style={{ background: "rgba(18,7,9,0.7)", backdropFilter: "blur(6px)" }}
            />
            <motion.div
              className="relative max-w-sm w-full rounded-2xl p-6 z-10"
              style={{ background: "var(--studio-panel)", border: "1px solid var(--studio-border)" }}
              initial={{ scale: 0.95, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 8 }}
              onClick={(e) => e.stopPropagation()}
            >
              <span
                className="text-[10px] font-mono uppercase tracking-widest"
                style={{ color: "var(--studio-accent-light)" }}
              >
                in the lab
              </span>
              <h3 className="text-lg font-medium mt-2 mb-3" style={{ color: "var(--studio-text)" }}>
                {modal.title}
              </h3>
              {modal.description ? (
                <p className="text-sm leading-relaxed" style={{ color: "var(--studio-text-muted)" }}>
                  {modal.description}
                </p>
              ) : (
                <p className="text-sm italic" style={{ color: "var(--studio-text-muted)" }}>
                  Work in progress — details coming soon.
                </p>
              )}
              <button
                className="mt-5 text-xs"
                style={{ color: "var(--studio-text-muted)" }}
                onClick={() => setModal(null)}
              >
                close ✕
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
