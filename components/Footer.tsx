import Link from "next/link";
import { FooterEmblem } from "./FooterEmblem";

export function Footer() {
  return (
    <footer data-site-footer="" className="w-full overflow-hidden border-t border-white/6 bg-linear-to-b from-transparent via-(--lobby-surface)/40 to-(--lobby-surface)/90 px-6 pt-16 pb-6">
      <div className="mx-auto flex max-w-5xl flex-col items-start gap-10 md:flex-row md:items-end md:justify-between">
        <p className="font-sans text-[13vw] leading-[0.9] tracking-tight text-(--lobby-text) md:text-[6.5rem]" data-footer-line="">
          i&apos;m glad
          <br />
          you&apos;re here.
        </p>
        <FooterEmblem className="size-40 md:size-52" />
      </div>

      <div className="mx-auto mt-14 flex max-w-5xl items-center justify-between font-sans text-sm text-text-muted">
        <span>© {new Date().getFullYear()} Divine Eze</span>
        <nav className="flex items-center gap-5" aria-label="footer navigation">
          <Link href="/now" className="transition-colors hover:text-(--lobby-text)">
            now
          </Link>
          <Link href="/colophon" className="transition-colors hover:text-(--lobby-text)">
            colophon
          </Link>
        </nav>
      </div>
    </footer>
  );
}
