"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { MusicProject } from "@/app/actions/studio";
import { FxStage } from "@/components/fx/FxStage";

type Props = {
  projects: MusicProject[];
};

/**
 * Work in progress under a neon sign. Each card opens a native modal dialog (focus trapped,
 * Escape closes, focus returns to the card), dismissed by its button or a click outside.
 */
export function InTheLab({ projects }: Props) {
  const [open, setOpen] = useState<MusicProject | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  if (!projects.length) return null;

  return (
    <section className="mx-auto max-w-6xl px-6 pb-16" aria-labelledby="in-the-lab" data-in-the-lab="">
      <div className="border-t border-(--studio-border) pt-6">
        <h2 id="in-the-lab" className="sr-only">
          in the lab
        </h2>
        <FxStage effect="neon-sign" room="studio" options={{ text: "IN THE LAB" }} className="h-32 w-full md:h-44" />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {projects.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setOpen(p)}
            className="overflow-hidden rounded-xl border border-(--studio-border) bg-(--studio-panel) text-left opacity-75 transition-opacity hover:opacity-100 focus-visible:opacity-100"
          >
            <span className="relative block aspect-square">
              {p.artwork_path ? (
                <Image src={p.artwork_path} alt="" fill className="object-cover" sizes="(max-width: 640px) 50vw, 25vw" />
              ) : (
                <span className="flex size-full items-center justify-center bg-(--studio-raised) text-4xl text-(--studio-text-muted)" aria-hidden="true">
                  ♪
                </span>
              )}
              <span className="absolute top-2 right-2 rounded bg-(--studio-accent-light) px-1.5 py-0.5 font-mono text-[10px] text-(--studio-text)">WIP</span>
            </span>
            <span className="block truncate p-3 text-sm text-(--studio-text)">{p.title}</span>
          </button>
        ))}
      </div>

      <dialog
        ref={dialogRef}
        aria-labelledby="lab-dialog-title"
        className="studio-dialog m-auto w-full max-w-sm rounded-2xl border border-(--studio-border) bg-(--studio-panel) p-6 text-(--studio-text)"
        onClose={() => setOpen(null)}
        onClick={(e) => {
          // A click on the backdrop lands on the dialog element itself, outside its box
          const r = e.currentTarget.getBoundingClientRect();
          const outside = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
          if (e.target === e.currentTarget && outside) setOpen(null);
        }}
      >
        {open && (
          <>
            <span className="font-mono text-[10px] tracking-widest text-(--studio-accent-light) uppercase">in the lab</span>
            <h3 id="lab-dialog-title" className="mt-2 mb-3 text-lg font-medium">
              {open.title}
            </h3>
            {open.description ? (
              <p className="text-sm leading-relaxed text-(--studio-text-muted)">{open.description}</p>
            ) : (
              <p className="text-sm text-(--studio-text-muted) italic">Work in progress. Details soon.</p>
            )}
            <button type="button" className="mt-5 font-mono text-xs text-(--studio-text-muted) hover:text-(--studio-text)" onClick={() => setOpen(null)}>
              close
            </button>
          </>
        )}
      </dialog>
    </section>
  );
}
