import NextAuth from "next-auth";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { users } from "./db/schema";
import { env } from "./lib/env";
import { authConfig } from "./auth.config";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      image?: string | null;
    };
  }
}

/**
 * Custom JWT shape stored in the encrypted cookie.
 * We don't use module augmentation for @auth/core/jwt because
 * the re-export chain makes it unreliable with bundler resolution.
 */
interface CustomJWT {
  userId: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpires: number;
  email?: string | null;
  [key: string]: unknown;
}

async function refreshAccessToken(token: CustomJWT): Promise<CustomJWT> {
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: token.refreshToken,
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const refreshed = await response.json();

  if (!response.ok) {
    throw new Error("Failed to refresh access token");
  }

  return {
    ...token,
    accessToken: refreshed.access_token as string,
    accessTokenExpires: Date.now() + (refreshed.expires_in as number) * 1000,
    refreshToken:
      (refreshed.refresh_token as string | undefined) ?? token.refreshToken,
  };
}

const nextAuth = NextAuth({
  ...authConfig,
  callbacks: {
    async signIn({ account, profile }) {
      if (!account || !profile?.email) return false;

      const googleId = account.providerAccountId;
      const email = profile.email;
      const name = profile.name ?? email;
      const avatarUrl = profile.picture as string | undefined;

      // Upsert user
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.googleId, googleId))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(users)
          .set({ email, name, avatarUrl })
          .where(eq(users.googleId, googleId));
      } else {
        await db.insert(users).values({ googleId, email, name, avatarUrl });
      }

      return true;
    },
    async jwt({ token, account }) {
      const t = token as unknown as CustomJWT;

      // On initial sign-in, persist tokens
      if (account) {
        const dbUser = await db
          .select()
          .from(users)
          .where(eq(users.email, token.email!))
          .limit(1);

        return {
          ...t,
          userId: dbUser[0].id,
          accessToken: account.access_token!,
          refreshToken: account.refresh_token!,
          accessTokenExpires:
            Date.now() + (account.expires_in as number) * 1000,
        };
      }

      // Return token if it hasn't expired
      if (Date.now() < t.accessTokenExpires) {
        return t;
      }

      // Token expired — refresh it
      return refreshAccessToken(t);
    },
    async session({ session, token }) {
      const t = token as unknown as CustomJWT;
      session.user.id = t.userId;
      return session;
    },
  },
});

export const { handlers, auth, signIn, signOut } = nextAuth;

/**
 * Server-only helper to retrieve the Google access token from the JWT.
 * Never exposed to the client — call this only in server components,
 * server actions, or route handlers.
 */
export async function getAccessToken(): Promise<string | null> {
  const session = await nextAuth.auth();
  if (!session) return null;
  // auth() on the server returns the full token via the jwt callback.
  // We access it through the internal token property.
  // Use unstable_getServerSession alternative: decode JWT directly.
  const { cookies } = await import("next/headers");
  const { decode } = await import("next-auth/jwt");
  const cookieStore = await cookies();
  const secureCookie = process.env.NODE_ENV === "production";
  const cookieName = secureCookie
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";
  const tokenValue = cookieStore.get(cookieName)?.value;
  if (!tokenValue) return null;

  const decoded = (await decode({
    token: tokenValue,
    secret: env.NEXTAUTH_SECRET,
    salt: cookieName,
  })) as CustomJWT | null;

  return decoded?.accessToken ?? null;
}
