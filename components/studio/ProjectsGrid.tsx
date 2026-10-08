"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Pause, Play } from "lucide-react";
import type { MusicProject, Track } from "@/app/actions/studio";
import { useAudio, buildPlaylist } from "@/lib/audio/AudioContext";
import { FxStage, type FxHandle } from "@/components/fx/FxStage";
import type { GalleryItem } from "@/components/fx/effects/studio-gallery/meta";
import { Cta } from "@/components/fx/ui/Cta";
import { cn } from "@/lib/utils";

/** A press that moves less than this, and lets go sooner, is a click on a panel, not a drag */
const CLICK_PX = 6;
const CLICK_MS = 250;

function formatDur(s: number | null) {
  if (!s) return "";
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

function metaOf(p: MusicProject) {
  const n = p.tracks?.length ?? 0;
  return [p.release_year, n ? `${n} ${n === 1 ? "track" : "tracks"}` : null].filter(Boolean).join(" · ");
}

function TrackRow({ track, index, project }: { track: Track; index: number; project: MusicProject }) {
  const { currentTrack, isPlaying, play, pause, resume } = useAudio();
  const isActive = currentTrack?.id === track.id;
  const sounding = isActive && isPlaying;

  const handleClick = () => {
    if (isActive) {
      if (isPlaying) pause();
      else resume();
    } else {
      const playlist = buildPlaylist(project);
      play(playlist[index], playlist);
    }
  };

  return (
    <li>
      <button
        type="button"
        onClick={handleClick}
        aria-label={`${sounding ? "Pause" : "Play"} ${track.title}`}
        aria-current={isActive ? "true" : undefined}
        className={cn(
          "group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-(--studio-raised) focus-visible:bg-(--studio-raised)",
          isActive && "bg-(--studio-raised)"
        )}
      >
        <span className="flex w-6 shrink-0 items-center justify-center" aria-hidden="true">
          {sounding ? (
            <FxStage effect="track-meter" room="studio" options={{ accent: "studio-player-accent" }} className="size-4" />
          ) : isActive ? (
            <Play size={12} fill="currentColor" className="text-(--studio-player-accent)" />
          ) : (
            <>
              <span className="font-mono text-xs text-(--studio-text-muted) group-hover:hidden group-focus-visible:hidden">{index + 1}</span>
              <Play size={12} fill="currentColor" className="hidden text-(--studio-text) group-hover:block group-focus-visible:block" />
            </>
          )}
        </span>
        <span className={cn("flex-1 truncate text-sm", isActive ? "text-(--studio-text)" : "text-(--studio-text-muted)")}>{track.title}</span>
        {track.duration_seconds ? (
          <span className="shrink-0 font-mono text-xs text-(--studio-text-muted)">{formatDur(track.duration_seconds)}</span>
        ) : null}
      </button>
    </li>
  );
}

function ProjectDetail({ project, onClose }: { project: MusicProject; onClose: () => void }) {
  const { play, pause, isPlaying, currentTrack } = useAudio();
  const tracks = project.tracks ?? [];
  const sounding = tracks.some((t) => t.id === currentTrack?.id) && isPlaying;

  const playAll = () => {
    if (!tracks.length) return;
    if (sounding) pause();
    else {
      const playlist = buildPlaylist(project);
      play(playlist[0], playlist);
    }
  };

  return (
    <section
      aria-labelledby={`project-${project.id}`}
      className="rounded-xl border border-(--studio-border) bg-(--studio-panel)/90 p-4 backdrop-blur-sm md:p-6"
      data-project-detail={project.slug}
    >
      <div className="mb-4 flex gap-4">
        <div className="relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-lg bg-(--studio-raised)">
          {project.artwork_path ? (
            <Image src={project.artwork_path} alt="" fill className="object-cover" sizes="80px" />
          ) : (
            // Drawn like the gallery's strips for projects without artwork: the initial
            <span className="font-sans text-3xl text-(--studio-text-muted)" aria-hidden="true">
              {project.title.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 id={`project-${project.id}`} className="text-lg text-(--studio-text)">
            {project.title}
          </h3>
          <p className="mt-0.5 font-mono text-xs text-(--studio-text-muted)">{metaOf(project)}</p>
          {project.description && <p className="mt-2 text-sm leading-relaxed text-(--studio-text-muted)">{project.description}</p>}
        </div>
      </div>

      {tracks.length > 0 ? (
        <ol className="overflow-hidden rounded-lg bg-(--studio-base)/70">
          {tracks.map((track, i) => (
            <TrackRow key={track.id} track={track} index={i} project={project} />
          ))}
        </ol>
      ) : (
        <p className="py-4 text-center text-xs text-(--studio-text-muted)">No tracks yet</p>
      )}

      <div className="mt-4 flex items-center gap-3">
        {tracks.length > 0 && (
          <Cta
            variant="slide"
            room="studio"
            size="sm"
            label={sounding ? "pause" : "play all"}
            icon={sounding ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
            onClick={playAll}
          />
        )}
        <button type="button" onClick={onClose} className="ml-auto font-mono text-xs text-(--studio-text-muted) hover:text-(--studio-text)">
          close
        </button>
      </div>
    </section>
  );
}

/**
 * The projects as a helix (ThreeUI's Gallery in three) that turns on its own: drag it to spin,
 * click a panel to open that project. Below it, the same projects as a list of buttons, the
 * twin for keyboards and assistive tech; choosing either way turns the helix to that project
 * and opens its tracklist under the list as ordinary DOM.
 */
export function ProjectsGrid({ projects }: { projects: MusicProject[] }) {
  const gallery = useRef<FxHandle>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const press = useRef<{ x: number; y: number; t: number; lastX: number; lastT: number; vx: number; dragging: boolean } | null>(null);

  const items = useMemo<GalleryItem[]>(
    () => projects.map((p) => ({ title: p.title, meta: metaOf(p), artwork: p.artwork_path })),
    [projects]
  );

  useEffect(() => {
    gallery.current?.command("items", items);
  }, [items]);

  const clear = () => {
    setSelected(null);
    gallery.current?.command("select", -1);
  };

  const choose = (index: number, from: "gallery" | "list") => {
    setSelected(index);
    gallery.current?.command("select", index);
    gallery.current?.command("focus", index);
    if (from === "gallery") requestAnimationFrame(() => detailRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  };

  // A panel picked in the helix arrives as an event from its canvas
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onPick = (e: Event) => {
      const index = (e as CustomEvent<{ index: number }>).detail?.index;
      if (typeof index === "number") choose(index, "gallery");
    };
    el.addEventListener("fx:pick", onPick);
    return () => el.removeEventListener("fx:pick", onPick);
  });

  if (!projects.length) return null;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    press.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, lastX: e.clientX, lastT: e.timeStamp, vx: 0, dragging: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = press.current;
    if (!p) return;
    if (!p.dragging && Math.hypot(e.clientX - p.x, e.clientY - p.y) >= CLICK_PX) p.dragging = true;
    if (!p.dragging) return;
    const dx = e.clientX - p.lastX;
    const dt = Math.max(1, e.timeStamp - p.lastT);
    p.vx = p.vx * 0.6 + (dx / dt) * 0.4;
    p.lastX = e.clientX;
    p.lastT = e.timeStamp;
    gallery.current?.command("drag", { dx });
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const p = press.current;
    press.current = null;
    if (!p) return;
    if (!p.dragging && e.timeStamp - p.t < CLICK_MS) {
      const r = e.currentTarget.getBoundingClientRect();
      gallery.current?.command("pick", { x: e.clientX - r.left, y: e.clientY - r.top });
    } else {
      gallery.current?.command("release", { vx: p.dragging ? p.vx : 0 });
    }
  };

  const current = selected !== null ? projects[selected] : null;

  return (
    <section className="mx-auto max-w-6xl px-6 py-8" aria-labelledby="studio-projects">
      <h2 id="studio-projects" className="mb-2 font-mono text-xs tracking-widest text-(--studio-text-muted) uppercase">
        projects
      </h2>

      <div
        ref={stageRef}
        className="studio-gallery -mx-6"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          press.current = null;
          gallery.current?.command("release", { vx: 0 });
        }}
        data-studio-gallery=""
      >
        <FxStage effect="studio-gallery" room="studio" handle={gallery} className="absolute inset-0" />
      </div>

      <ul className="mt-6 flex flex-wrap gap-2" aria-label="projects">
        {projects.map((p, i) => (
          <li key={p.id}>
            <button
              type="button"
              aria-pressed={selected === i}
              onClick={() => (selected === i ? clear() : choose(i, "list"))}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-colors",
                selected === i
                  ? "border-(--studio-accent-light) bg-(--studio-accent) text-(--studio-text)"
                  : "border-(--studio-border) bg-(--studio-panel)/80 text-(--studio-text-muted) hover:text-(--studio-text)"
              )}
            >
              {p.title}
              {p.release_year && <span className="ml-2 font-mono text-xs opacity-70">{p.release_year}</span>}
            </button>
          </li>
        ))}
      </ul>

      <div ref={detailRef} className="mt-4">
        {current && <ProjectDetail key={current.id} project={current} onClose={clear} />}
      </div>
    </section>
  );
}
