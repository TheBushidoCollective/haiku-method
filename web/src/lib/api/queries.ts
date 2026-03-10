import { db } from "@/db";
import { organizations, teams, memberships, users } from "@/db/schema";
import { eq, and, count } from "drizzle-orm";

export async function getOrgBySlug(slug: string) {
  const rows = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);
  return rows[0] ?? null;
}

export async function getTeamBySlug(orgId: string, slug: string) {
  const rows = await db
    .select()
    .from(teams)
    .where(and(eq(teams.orgId, orgId), eq(teams.slug, slug)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getOrgsForUser(userId: string) {
  const rows = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      driveFolderId: organizations.driveFolderId,
      createdAt: organizations.createdAt,
      role: memberships.role,
    })
    .from(organizations)
    .innerJoin(teams, eq(teams.orgId, organizations.id))
    .innerJoin(memberships, eq(memberships.teamId, teams.id))
    .where(eq(memberships.userId, userId));

  // Deduplicate and pick highest role (admin > member)
  const orgMap = new Map<
    string,
    (typeof rows)[number]
  >();
  for (const row of rows) {
    const existing = orgMap.get(row.id);
    if (!existing || (row.role === "admin" && existing.role !== "admin")) {
      orgMap.set(row.id, row);
    }
  }
  return Array.from(orgMap.values());
}

export async function getTeamsForOrg(orgId: string) {
  const teamRows = await db.select().from(teams).where(eq(teams.orgId, orgId));

  const result = [];
  for (const team of teamRows) {
    const memberCount = await db
      .select({ count: count() })
      .from(memberships)
      .where(eq(memberships.teamId, team.id));
    result.push({
      ...team,
      memberCount: memberCount[0]?.count ?? 0,
    });
  }
  return result;
}

export async function getMembersForTeam(teamId: string) {
  return db
    .select({
      id: memberships.id,
      userId: memberships.userId,
      teamId: memberships.teamId,
      role: memberships.role,
      createdAt: memberships.createdAt,
      userName: users.name,
      userEmail: users.email,
      userAvatarUrl: users.avatarUrl,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(eq(memberships.teamId, teamId));
}

export async function isOrgAdmin(orgId: string, userId: string) {
  const rows = await db
    .select({ id: memberships.id })
    .from(memberships)
    .innerJoin(teams, eq(memberships.teamId, teams.id))
    .where(
      and(
        eq(teams.orgId, orgId),
        eq(memberships.userId, userId),
        eq(memberships.role, "admin")
      )
    )
    .limit(1);
  return rows.length > 0;
}

export async function isTeamAdmin(teamId: string, userId: string) {
  const rows = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(
        eq(memberships.teamId, teamId),
        eq(memberships.userId, userId),
        eq(memberships.role, "admin")
      )
    )
    .limit(1);
  return rows.length > 0;
}
