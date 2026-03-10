import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isAuthenticated = !!req.auth;
  const isLoginPage = req.nextUrl.pathname.startsWith("/login");
  const isAuthApi = req.nextUrl.pathname.startsWith("/api/auth");
  const isMcp = req.nextUrl.pathname.startsWith("/mcp");

  // Allow auth API routes and MCP endpoint through
  if (isAuthApi || isMcp) return;

  // Redirect authenticated users away from login
  if (isAuthenticated && isLoginPage) {
    return Response.redirect(new URL("/", req.nextUrl.origin));
  }

  // Redirect unauthenticated users to login
  if (!isAuthenticated && !isLoginPage) {
    return Response.redirect(new URL("/login", req.nextUrl.origin));
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public/).*)"],
};
