import { auth } from "@/auth";
import { db } from "@/db";
import { memberships, teams } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

export interface AuthUser {
  id: string;
  email: string;
}

export async function requireAuth(): Promise<
  AuthUser | NextResponse
> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return { id: session.user.id, email: session.user.email };
}

export async function requireOrgMember(
  orgId: string
): Promise<AuthUser | NextResponse> {
  const userOrRes = await requireAuth();
  if (userOrRes instanceof NextResponse) return userOrRes;

  const membership = await db
    .select({ id: memberships.id })
    .from(memberships)
    .innerJoin(teams, eq(memberships.teamId, teams.id))
    .where(and(eq(teams.orgId, orgId), eq(memberships.userId, userOrRes.id)))
    .limit(1);

  if (membership.length === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return userOrRes;
}

export async function requireOrgAdmin(
  orgId: string
): Promise<AuthUser | NextResponse> {
  const userOrRes = await requireAuth();
  if (userOrRes instanceof NextResponse) return userOrRes;

  const membership = await db
    .select({ id: memberships.id })
    .from(memberships)
    .innerJoin(teams, eq(memberships.teamId, teams.id))
    .where(
      and(
        eq(teams.orgId, orgId),
        eq(memberships.userId, userOrRes.id),
        eq(memberships.role, "admin")
      )
    )
    .limit(1);

  if (membership.length === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return userOrRes;
}

export async function requireTeamMember(
  teamId: string
): Promise<AuthUser | NextResponse> {
  const userOrRes = await requireAuth();
  if (userOrRes instanceof NextResponse) return userOrRes;

  const membership = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(eq(memberships.teamId, teamId), eq(memberships.userId, userOrRes.id))
    )
    .limit(1);

  if (membership.length === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return userOrRes;
}

export async function requireTeamAdmin(
  teamId: string
): Promise<AuthUser | NextResponse> {
  const userOrRes = await requireAuth();
  if (userOrRes instanceof NextResponse) return userOrRes;

  const membership = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(
        eq(memberships.teamId, teamId),
        eq(memberships.userId, userOrRes.id),
        eq(memberships.role, "admin")
      )
    )
    .limit(1);

  if (membership.length === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return userOrRes;
}
