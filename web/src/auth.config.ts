import Google from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";

/**
 * Auth.js provider configuration — Edge-compatible (no Node.js deps).
 * Used by middleware. The full auth config in auth.ts extends this with
 * database-dependent callbacks.
 */
export const authConfig = {
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/drive",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
} satisfies NextAuthConfig;
