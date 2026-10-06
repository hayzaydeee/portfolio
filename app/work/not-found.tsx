import Link from "next/link";

/** An unknown project stays inside the IDE: the title bar and its crumb remain above this */
export default function ProjectNotFound() {
  return (
    <div className="flex flex-1 flex-col items-start justify-center gap-4 bg-(--workshop-panel) px-8 py-24 font-mono text-sm">
      <h1 className="text-(--workshop-text)">file not found</h1>
      <p className="text-(--workshop-text-muted)">
        <span className="text-(--workshop-syntax)">$</span> cat README.md: no such project in this workshop
      </p>
      <Link href="/work" className="text-(--workshop-syntax) underline-offset-4 hover:underline">
        cd ~/workshop
      </Link>
    </div>
  );
}
