export function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-sans tracking-[0.2em] uppercase text-(--lobby-accent) mb-8 text-center select-none">
      {children}
    </h2>
  );
}
