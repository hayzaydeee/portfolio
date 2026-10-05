import "server-only";
import { auth } from "@/auth";

/**
 * Guard for Server Actions. Proxy only protects /admin pages, but any Server Action
 * can be POSTed to from any route, so every privileged action must check for itself.
 */
export async function requireAdmin(): Promise<void> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email || !process.env.ADMIN_EMAIL || email !== process.env.ADMIN_EMAIL) {
    throw new Error("Unauthorized");
  }
}
