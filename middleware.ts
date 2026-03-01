import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { withAuth } from "next-auth/middleware";

// Protect /superadmin/* (except /superadmin/login)
function superAdminMiddleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  if (path.startsWith("/superadmin") && !path.startsWith("/superadmin/login")) {
    const saSession = req.cookies.get("sa-session");
    if (!saSession?.value) {
      return NextResponse.redirect(new URL("/superadmin/login", req.url));
    }
  }
  return null;
}

// Compose: check superadmin routes first, then delegate /dashboard/* to NextAuth
export default withAuth(
  function middleware(req) {
    const saRedirect = superAdminMiddleware(req);
    if (saRedirect) return saRedirect;
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Only enforce auth for /dashboard routes
        if (req.nextUrl.pathname.startsWith("/dashboard")) {
          return !!token;
        }
        // All other routes (including /superadmin handled above) pass through
        return true;
      },
    },
  }
);

export const config = {
  matcher: ["/dashboard/:path*", "/superadmin/:path*"],
};
