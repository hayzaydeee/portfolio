"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { HzyMark, type HzyMarkMode } from "@/components/nav/HzyMark";
import { FxStage } from "@/components/fx/FxStage";
import type { RoomKey } from "@/components/fx/runtime/types";
import { CONTACT_HREF, CV_HREF, ROOM_LINKS, type DockVariant, type RoomLink } from "@/lib/rooms";
import { cn } from "@/lib/utils";
import { LINE_ICONS, PIXEL_ICONS, type DockIconKey } from "./dockIcons";
import { useRoomVisibility } from "./RoomsContext";
import { TransitionLink } from "./TransitionLink";
import { useDockMagnify } from "./useDockMagnify";

/**
 * The house navigation, adapted from ThreeUI's AnimatedTopDock (MIT, Meng To) in its four
 * variants: sable (lobby and edges), modern (notebook, wall), retro (embedded in the
 * workshop IDE) and glass (the studio rail). Styles live in app/styles/dock.css.
 */

const MARK_MODE: Record<RoomKey, HzyMarkMode> = {
  lobby: "dark",
  workshop: "dark",
  studio: "dark",
  notebook: "light",
  wall: "light",
};

type DockProps = {
  variant: DockVariant;
  room: RoomKey;
  /** Workshop path segments after ~/workshop, e.g. a project slug */
  crumbs?: string[];
  className?: string;
};

function Icon({ name, pixel = false }: { name: DockIconKey; pixel?: boolean }) {
  return (
    <span className={cn("dock-icon", pixel ? "dock-icon--pixel" : "dock-icon--line")} aria-hidden="true">
      <svg viewBox={pixel ? "0 0 7 7" : "0 0 16 16"}>{pixel ? PIXEL_ICONS[name] : LINE_ICONS[name]}</svg>
    </span>
  );
}

/** The HZY mark the splash flies into; shared layoutId keeps the handoff continuous */
function Mark({ room, className }: { room: RoomKey; className?: string }) {
  return (
    <motion.span layoutId="hzy-mark" data-hzy-mark-target className={cn("block", className)}>
      <HzyMark mode={MARK_MODE[room]} />
    </motion.span>
  );
}

function RoomItem({
  link,
  room,
  className,
  pixel,
}: {
  link: RoomLink;
  room: RoomKey;
  className: string;
  pixel?: boolean;
}) {
  const current = link.room === room;
  return (
    <TransitionLink
      href={link.href}
      data-dock-item
      aria-current={current ? "page" : undefined}
      className={className}
    >
      <Icon name={link.room} pixel={pixel} />
      <span className="dock-label">{link.label}</span>
    </TransitionLink>
  );
}

/** CV and contact, folded behind one disclosure where the variant has no action area */
function MoreMenu({ className }: { className: string }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="dock-more">
      <button
        type="button"
        data-dock-item
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className={className}
      >
        <Icon name="more" />
        <span className="dock-label">more</span>
      </button>
      {open && (
        <div id={menuId} className="dock-menu">
          <a href={CV_HREF} download onClick={() => setOpen(false)}>
            <Icon name="cv" />
            download cv
          </a>
          <a href={CONTACT_HREF} onClick={() => setOpen(false)}>
            <Icon name="contact" />
            get in touch
          </a>
        </div>
      )}
    </div>
  );
}

const ArrowIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d="M3.2 8h9.1M8.6 4.3 12.4 8l-3.8 3.7" />
  </svg>
);

export function Dock({ variant, room, crumbs = [], className }: DockProps) {
  const navRef = useRef<HTMLElement>(null);
  const visibility = useRoomVisibility();
  const links = ROOM_LINKS.filter((l) => visibility[l.room]);
  const resetKey = `${variant}|${links.map((l) => l.room).join(",")}`;

  useDockMagnify(navRef, {
    mode: variant === "retro" ? "grow" : "size",
    lockTrack: variant === "modern",
    resetKey,
  });

  let body: ReactNode;

  if (variant === "sable") {
    body = (
      <nav ref={navRef} aria-label="rooms" className="dock-sable">
        <TransitionLink
          href="/"
          data-dock-item
          data-dock-mark="true"
          aria-label="lobby"
          aria-current={room === "lobby" ? "page" : undefined}
          className="dock-item dock-item--mark"
        >
          <Mark room={room} className="size-full" />
        </TransitionLink>
        {links.map((link) => (
          <RoomItem key={link.room} link={link} room={room} className="dock-item dock-item--link" />
        ))}
        <MoreMenu className="dock-item dock-item--link" />
      </nav>
    );
  } else if (variant === "modern") {
    body = (
      <div className="dock-modern">
        <TransitionLink href="/" aria-label="lobby" className="dock-brand">
          <Mark room={room} className="dock-brand-mark" />
          <span className="dock-brand-word">hayzaydee</span>
        </TransitionLink>
        <nav ref={navRef} aria-label="rooms" className="dock-track">
          {links.map((link) => (
            <RoomItem key={link.room} link={link} room={room} className="dock-item" />
          ))}
        </nav>
        <div className="dock-actions">
          <a href={CV_HREF} download className="dock-ghost">
            cv
          </a>
          <a href={CONTACT_HREF} className="dock-cta">
            <span className="dock-label">get in touch</span>
            <ArrowIcon />
          </a>
        </div>
      </div>
    );
  } else if (variant === "retro") {
    body = (
      <div className="dock-retro">
        <FxStage slot="workshop.dock" className="absolute inset-0" posterClassName="bg-(--workshop-tree)" />
        <div className="dock-retro-vignette" aria-hidden="true" />
        <div className="dock-retro-bar">
          <div className="dock-retro-brand">
            <TransitionLink href="/" aria-label="lobby" className="dock-retro-mark">
              <Mark room={room} className="size-4" />
            </TransitionLink>
            <span className="dock-retro-path">
              <Link href="/work">~/workshop</Link>
              {crumbs.map((c) => (
                <span key={c} className="dock-retro-crumb">
                  /{c}
                </span>
              ))}
            </span>
          </div>
          <nav ref={navRef} aria-label="rooms" className="dock-track">
            {links.map((link) => (
              <RoomItem key={link.room} link={link} room={room} className="dock-item" pixel />
            ))}
          </nav>
          <a href={CONTACT_HREF} className="dock-retro-cta">
            <span aria-hidden="true">▶</span>
            <span className="dock-label">contact</span>
          </a>
        </div>
      </div>
    );
  } else {
    body = (
      <div className="dock-glass">
        <div className="dock-glass-field" aria-hidden="true">
          <FxStage slot="studio.dock" className="absolute inset-0" posterClassName="bg-(--studio-raised)" />
        </div>
        <TransitionLink href="/" aria-label="lobby" className="dock-glass-brand">
          <Mark room={room} className="dock-glass-mark" />
          <span className="dock-glass-word">hayzaydee</span>
        </TransitionLink>
        <span className="dock-hairline" aria-hidden="true" />
        <nav ref={navRef} aria-label="rooms" className="dock-track">
          {links.map((link) => (
            <RoomItem key={link.room} link={link} room={room} className="dock-item" />
          ))}
        </nav>
        <span className="dock-hairline" aria-hidden="true" />
        <a href={CONTACT_HREF} className="dock-glass-cta">
          <span className="dock-label">get in touch</span>
          <ArrowIcon />
        </a>
      </div>
    );
  }

  return (
    <div className={cn("dock", className)} data-dock-variant={variant} data-dock-room={room}>
      {body}
    </div>
  );
}
