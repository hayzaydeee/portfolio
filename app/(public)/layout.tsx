import { Footer } from "@/components/Footer";
import { PageTransition } from "@/components/PageTransition";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Room for the floating sable dock (RoomChrome, root layout) */}
      <div className="h-16 shrink-0" aria-hidden="true" />
      <PageTransition>
        <main className="flex-1">{children}</main>
      </PageTransition>
      <Footer />
    </>
  );
}
