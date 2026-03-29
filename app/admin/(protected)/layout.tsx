import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminSidebar } from "@/components/admin/Sidebar";
import { headers } from "next/headers";
import { getCurrently } from "@/lib/data/currently";

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/admin/login");

  // Determine active section from request URL for sidebar highlight
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";

  const current = await getCurrently();

  return (
    <div className="min-h-screen flex bg-(--lobby-surface)">
      <AdminSidebar active={pathname} current={current} />
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
