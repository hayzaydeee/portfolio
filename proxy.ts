import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoginPage = req.nextUrl.pathname === "/admin/login";

  // Allow the login page through regardless of auth state
  if (isLoginPage) return NextResponse.next();

  // Redirect unauthenticated requests to the login page
  if (!req.auth) {
    const loginUrl = new URL("/admin/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*"],
};

export const config = {
  matcher: ["/admin/:path*"],
};
