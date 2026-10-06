"use client";

import type { MouseEventHandler, ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { RoomKey } from "@/components/fx/runtime/types";
import { usePrimRoom } from "./usePrimRoom";

/**
 * Round icon buttons rebuilt from ThreeUI's CircleButtons (MIT, Meng To), in room colours.
 *
 *   glass  frosted face with an orbiting aura (play)
 *   key    a raised accent key that presses down; stays down while pressed (plus)
 *   trace  hairline face; corner dots and dashed edges close in on hover (mail)
 */
export type CircleButtonVariant = "glass" | "key" | "trace";

type Props = {
  variant?: CircleButtonVariant;
  /** Accessible name; the button shows only its icon */
  label: string;
  icon: ReactNode;
  /** Toggle state, announced as aria-pressed */
  pressed?: boolean;
  size?: "sm" | "md";
  room?: RoomKey;
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: MouseEventHandler<HTMLButtonElement>;
  className?: string;
};

export function CircleButton({
  variant = "glass",
  label,
  icon,
  pressed,
  size = "md",
  room,
  disabled,
  type = "button",
  onClick,
  className,
}: Props) {
  const scope = usePrimRoom(room);
  return (
    <button
      type={type}
      className={cn("prim cbtn", `cbtn--${variant}`, size === "sm" && "cbtn--sm", className)}
      data-room={scope}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="cbtn__layer cbtn__aura" aria-hidden="true" />
      <span className="cbtn__layer cbtn__face" aria-hidden="true" />
      <span className="cbtn__layer cbtn__rim" aria-hidden="true" />
      {variant === "trace" && (
        <span className="cbtn__layer cbtn__details" aria-hidden="true">
          <span className="cbtn__dot cbtn__dot--1" />
          <span className="cbtn__dot cbtn__dot--2" />
          <span className="cbtn__dot cbtn__dot--3" />
          <span className="cbtn__dot cbtn__dot--4" />
          <span className="cbtn__edge cbtn__edge--h cbtn__edge--1" />
          <span className="cbtn__edge cbtn__edge--v cbtn__edge--2" />
          <span className="cbtn__edge cbtn__edge--h cbtn__edge--3" />
          <span className="cbtn__edge cbtn__edge--v cbtn__edge--4" />
        </span>
      )}
      <span className="cbtn__icon" aria-hidden="true">
        {icon}
      </span>
    </button>
  );
}
