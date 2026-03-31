"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { HzyMark } from "./HzyMark";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/work", label: "work" },
  { href: "/music", label: "music" },
  { href: "/notebook", label: "notebook" },
  { href: "/wall", label: "wall" },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

// ── Mood ring — nav temperature shifts subtly per room ────────────────────────

type RoomKey = "default" | "work" | "music";

const ROOM_NAV: Record<
  RoomKey,
  {
    header: string;
    link: string;
    linkHover: string;
    activeLink: string;
    underline: string;
    mobile: string;
    mobileLink: string;
    mobileActive: string;
    hamburger: string;
  }
> = {
  default: {
    header: "bg-(--lobby-surface)/90 border-white/6",
    link: "text-(--lobby-text)",
    linkHover: "hover:text-(--lobby-accent)",
    activeLink: "text-(--lobby-accent)",
    underline: "bg-(--lobby-accent)",
    mobile: "bg-(--lobby-surface)",
    mobileLink: "text-(--lobby-text)",
    mobileActive: "text-(--lobby-accent)",
    hamburger: "bg-(--lobby-text)",
  },
  work: {
    header: "bg-(--workshop-panel)/95 border-(--workshop-tree-border)",
    link: "text-(--workshop-text)",
    linkHover: "hover:text-(--workshop-syntax)",
    activeLink: "text-(--workshop-syntax)",
    underline: "bg-(--workshop-syntax)",
    mobile: "bg-(--workshop-panel)",
    mobileLink: "text-(--workshop-text)",
    mobileActive: "text-(--workshop-syntax)",
    hamburger: "bg-(--workshop-text)",
  },
  music: {
    header: "bg-(--studio-panel)/95 border-white/5",
    link: "text-(--studio-text)",
    linkHover: "hover:text-(--studio-accent-light)",
    activeLink: "text-(--studio-accent-light)",
    underline: "bg-(--studio-accent-light)",
    mobile: "bg-(--studio-panel)",
    mobileLink: "text-(--studio-text)",
    mobileActive: "text-(--studio-accent-light)",
    hamburger: "bg-(--studio-text)",
  },
};

function getRoomKey(pathname: string): RoomKey {
  if (pathname.startsWith("/work")) return "work";
  if (pathname.startsWith("/music")) return "music";
  return "default";
}

export function Nav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const roomStyle = ROOM_NAV[getRoomKey(pathname)];

  // Close mobile menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  return (
    <>
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-40 h-14 flex items-center px-6 backdrop-blur-md border-b transition-colors duration-300",
          roomStyle.header
        )}
      >
        <nav className="w-full max-w-5xl mx-auto flex items-center justify-between">
          {/* Mark */}
          <Link href="/" aria-label="hayzaydee home" className="flex items-center shrink-0">
            <motion.div layoutId="hzy-mark">
              <HzyMark mode="dark" size={48} />
            </motion.div>
          </Link>

          {/* Desktop links */}
          <ul className="hidden md:flex items-center gap-6 list-none m-0 p-0">
            {NAV_LINKS.map(({ href, label }) => {
              const active = isActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={cn(
                      "relative text-sm font-sans pb-0.5 transition-colors",
                      active
                        ? roomStyle.activeLink
                        : cn(roomStyle.link, roomStyle.linkHover)
                    )}
                  >
                    {label}
                    {active && (
                      <motion.span
                        layoutId="nav-underline"
                        className={cn("absolute bottom-0 left-0 right-0 h-px", roomStyle.underline)}
                        transition={{ type: "spring", stiffness: 380, damping: 40 }}
                      />
                    )}
                  </Link>
                </li>
              );
            })}
            <li>
              <a
                href="mailto:hayzayd33@gmail.com"
                className={cn("text-sm font-sans transition-colors", roomStyle.link, roomStyle.linkHover)}
              >
                ↗ get in touch
              </a>
            </li>
          </ul>

          {/* Mobile hamburger */}
          <button
            className="md:hidden flex flex-col justify-center items-center w-8 h-8 gap-1.5"
            aria-label={menuOpen ? "close menu" : "open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <motion.span
              animate={menuOpen ? { rotate: 45, y: 6 } : { rotate: 0, y: 0 }}
              className={cn("block w-5 h-px origin-center", roomStyle.hamburger)}
              transition={{ duration: 0.2 }}
            />
            <motion.span
              animate={menuOpen ? { opacity: 0 } : { opacity: 1 }}
              className={cn("block w-5 h-px", roomStyle.hamburger)}
              transition={{ duration: 0.15 }}
            />
            <motion.span
              animate={menuOpen ? { rotate: -45, y: -6 } : { rotate: 0, y: 0 }}
              className={cn("block w-5 h-px origin-center", roomStyle.hamburger)}
              transition={{ duration: 0.2 }}
            />
          </button>
        </nav>
      </header>

      {/* Mobile full-screen overlay */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            key="mobile-menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={cn("fixed inset-0 z-30 flex flex-col items-center justify-center gap-8 md:hidden", roomStyle.mobile)}
          >
            {NAV_LINKS.map(({ href, label }, i) => (
              <motion.div
                key={href}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ delay: i * 0.06, duration: 0.2 }}
              >
                <Link
                  href={href}
                  className={cn(
                    "text-3xl font-sans",
                    isActive(pathname, href)
                      ? roomStyle.mobileActive
                      : roomStyle.mobileLink
                  )}
                >
                  {label}
                </Link>
              </motion.div>
            ))}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ delay: NAV_LINKS.length * 0.06, duration: 0.2 }}
            >
              <a
                href="mailto:hayzayd33@gmail.com"
                className="text-xl font-sans text-(--lobby-text)"
             >
                ↗ get in touch
              </a>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spacer so content doesn't hide under fixed header */}
      <div className="h-14" aria-hidden="true" />
    </>
  );
}
