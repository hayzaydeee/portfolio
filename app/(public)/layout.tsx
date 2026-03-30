import { Nav } from "@/components/nav/Nav";
import { Footer } from "@/components/Footer";
import { PageTransition } from "@/components/PageTransition";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Nav />
      <PageTransition>
        <main className="flex-1">{children}</main>
      </PageTransition>
      <Footer />
    </>
  );
}
