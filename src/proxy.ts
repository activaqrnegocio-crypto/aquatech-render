import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;

        // 🔏 PUBLIC PATHS — Always allowed without session
        if (
          pathname === "/admin/login" ||
          pathname === "/admin/sw-test" ||
          pathname.startsWith("/api/auth") ||
          pathname.startsWith("/api/upload") ||
          pathname.startsWith("/api/cron") ||
          pathname.startsWith("/_next") ||
          pathname === "/favicon.ico" ||
          pathname === "/manifest.json" ||
          pathname === "/sw.js" ||
          pathname === "/custom-sw.js" ||
          pathname === "/offline.html" ||
          pathname === "/api/serve-sw"
        ) {
          return true;
        }

        // 🔒 Everything else requires an active session token
        return !!token;
      },
    },
    pages: {
      signIn: "/admin/login",
    },
  }
);

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/:path*",
  ],
};
