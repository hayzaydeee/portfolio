import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const pathname = req.nextUrl.pathname.replace(/\/$/, "");
  const isLoginPage = pathname === "/admin/login";

  // Allow the login page through regardless of auth state
  if (isLoginPage) return NextResponse.next();

  // Redirect unauthenticated requests to the login page
  if (!req.auth) {
    const loginUrl = new URL("/admin/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  // Pass pathname as header so server components can read the active section
  const res = NextResponse.next();
  res.headers.set("x-pathname", req.nextUrl.pathname);
  return res;
});

export const config = {
  matcher: ["/admin/:path*"],
};
