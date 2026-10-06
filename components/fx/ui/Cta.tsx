"use client";

import type { MouseEventHandler, ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { RoomKey } from "@/components/fx/runtime/types";
import { TransitionLink } from "./TransitionLink";
import { usePrimRoom } from "./usePrimRoom";

/**
 * Call-to-action buttons rebuilt from ThreeUI's RectangleButtons (MIT, Meng To), in the
 * colours of whichever room they sit in. Styles live in app/styles/primitives.css.
 *
 *   slide   label slides away and its twin falls in (sliding-text CTA)
 *   beam    an accent beam laps the border over a dot field (gradient-beam CTA)
 *   spin    a quiet edge becomes a spinning beam on hover (spinning-border button)
 *   trace   corner dots fly out and dashed edges draw round (dot-border button)
 *   keycap  a raised key with a status LED (Meridian keycap)
 */
export type CtaVariant = "slide" | "beam" | "spin" | "trace" | "keycap";

type Common = {
  variant?: CtaVariant;
  label: string;
  /** Trailing glyph; beam and spin show an arrow unless this is null */
  icon?: ReactNode | null;
  size?: "sm" | "md";
  /** Keycap only: a filled key in the room accent */
  emphasis?: "primary" | "secondary";
  room?: RoomKey;
  className?: string;
};

type AsLink = Common & {
  href: string;
  /** Plain anchor attributes for files and external links */
  download?: boolean | string;
  target?: "_blank";
  onClick?: MouseEventHandler<HTMLAnchorElement>;
};

type AsButton = Common & {
  href?: undefined;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
};

export type CtaProps = AsLink | AsButton;

const WITH_ARROW: ReadonlySet<CtaVariant> = new Set(["beam", "spin"]);

function Arrow() {
  return (
    <svg className="cta__icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

/** Links that leave the SPA: other origins, mail, and files served from /public */
function isPlainHref(href: string) {
  return /^(?:[a-z]+:|\/\/)/i.test(href) || /\.[a-z0-9]{2,4}(?:[?#].*)?$/i.test(href);
}

function Decor({ variant }: { variant: CtaVariant }) {
  switch (variant) {
    case "slide":
      return (
        <>
          <span className="cta__layer cta__underline" aria-hidden="true" />
          <span className="cta__layer cta__lift" aria-hidden="true" />
        </>
      );
    case "beam":
      return (
        <>
          <span className="cta__layer cta__beam" aria-hidden="true" />
          <span className="cta__layer cta__body" aria-hidden="true">
            <span className="cta__layer cta__dots" />
            <span className="cta__layer cta__glow" />
          </span>
        </>
      );
    case "spin":
      return (
        <>
          <span className="cta__layer cta__beam" aria-hidden="true" />
          <span className="cta__layer cta__edge" aria-hidden="true" />
        </>
      );
    case "trace":
      return (
        <span aria-hidden="true">
          <span className="cta__layer cta__hatch" />
          <span className="cta__layer cta__line cta__line--top" />
          <span className="cta__layer cta__line cta__line--right" />
          <span className="cta__layer cta__line cta__line--bottom" />
          <span className="cta__layer cta__line cta__line--left" />
          <span className="cta__layer cta__dot cta__dot--1" />
          <span className="cta__layer cta__dot cta__dot--2" />
          <span className="cta__layer cta__dot cta__dot--3" />
          <span className="cta__layer cta__dot cta__dot--4" />
        </span>
      );
    case "keycap":
      return (
        <>
          <span className="cta__layer cta__cap" aria-hidden="true" />
          <span className="cta__layer cta__led" aria-hidden="true" />
        </>
      );
  }
}

function Content({ variant, label, icon }: { variant: CtaVariant; label: string; icon: ReactNode }) {
  const text = (
    <span className="cta__label">
      {label}
      {icon}
    </span>
  );
  switch (variant) {
    case "slide":
      return (
        <>
          {text}
          <span className="cta__label cta__twin" aria-hidden="true">
            {label}
            {icon}
          </span>
        </>
      );
    // spin and trace carry their label on an inner face
    case "spin":
    case "trace":
      return <span className="cta__face">{text}</span>;
    default:
      return text;
  }
}

export function Cta(props: CtaProps) {
  const { variant = "slide", label, icon, size = "md", emphasis = "secondary", room, className } = props;
  const scope = usePrimRoom(room);
  const glyph = icon === undefined ? (WITH_ARROW.has(variant) ? <Arrow /> : null) : icon;

  const shared = {
    className: cn("prim cta", `cta--${variant}`, size === "sm" && "cta--sm", className),
    "data-room": scope,
    "data-emphasis": variant === "keycap" ? emphasis : undefined,
  };
  const body = (
    <>
      <Decor variant={variant} />
      <Content variant={variant} label={label} icon={glyph} />
    </>
  );

  if (props.href !== undefined) {
    const { href, download, target, onClick } = props;
    if (isPlainHref(href) || download !== undefined || target) {
      return (
        <a
          {...shared}
          href={href}
          download={download}
          target={target}
          rel={target ? "noopener noreferrer" : undefined}
          onClick={onClick}
        >
          {body}
        </a>
      );
    }
    return (
      <TransitionLink {...shared} href={href} onClick={onClick}>
        {body}
      </TransitionLink>
    );
  }

  const { type = "button", disabled, onClick } = props;
  return (
    <button {...shared} type={type} disabled={disabled} onClick={onClick}>
      {body}
    </button>
  );
}
