import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";

export interface McpUser {
  id: string;
  googleId: string;
  email: string;
  name: string;
  accessToken: string;
}

export class McpAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "McpAuthError";
  }
}

export async function authenticateRequest(
  authHeader: string | undefined
): Promise<McpUser> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new McpAuthError("Missing or invalid Authorization header");
  }

  const token = authHeader.slice(7);
  if (!token) {
    throw new McpAuthError("Empty bearer token");
  }

  // Validate token with Google
  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`
  );

  if (!res.ok) {
    throw new McpAuthError("Invalid or expired access token");
  }

  const tokenInfo = (await res.json()) as {
    email?: string;
    sub?: string;
  };

  if (!tokenInfo.sub || !tokenInfo.email) {
    throw new McpAuthError("Token missing required claims");
  }

  // Look up user in DB
  const dbUsers = await db
    .select()
    .from(users)
    .where(eq(users.googleId, tokenInfo.sub))
    .limit(1);

  if (dbUsers.length === 0) {
    throw new McpAuthError("User not found. Sign in via the web app first.");
  }

  const user = dbUsers[0];

  return {
    id: user.id,
    googleId: user.googleId,
    email: user.email,
    name: user.name,
    accessToken: token,
  };
}
