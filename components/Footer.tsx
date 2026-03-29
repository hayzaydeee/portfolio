import Link from "next/link";

export function Footer() {
  return (
    <footer className="w-full border-t border-white/6 py-6 px-6">
      <div className="max-w-5xl mx-auto flex items-center justify-between text-sm font-sans text-(--color-text-muted)">
        <span>© {new Date().getFullYear()} Divine Eze</span>
        <nav className="flex items-center gap-5" aria-label="footer navigation">
          <Link
            href="/now"
            className="hover:text-(--lobby-text) transition-colors"
          >
            now
          </Link>
          <Link
            href="/colophon"
            className="hover:text-(--lobby-text) transition-colors"
        >
            colophon
          </Link>
        </nav>
      </div>
    </footer>
  );
}
