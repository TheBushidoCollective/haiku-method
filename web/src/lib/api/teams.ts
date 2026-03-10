import { z } from "zod";
import { db } from "@/db";
import { teams, memberships, organizations } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getAccessToken } from "@/auth";
import { provisionWorkspace } from "@/lib/drive/workspace";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const createTeamSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(slugPattern, "Slug must be lowercase alphanumeric with hyphens"),
});

export const updateTeamSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

export async function listTeams(orgId: string) {
  return db.select().from(teams).where(eq(teams.orgId, orgId));
}

export async function getTeam(teamId: string) {
  const rows = await db
    .select()
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);
  return rows[0] ?? null;
}

export async function createTeam(
  orgId: string,
  userId: string,
  data: z.infer<typeof createTeamSchema>
) {
  // Check slug uniqueness within org
  const existing = await db
    .select({ id: teams.id })
    .from(teams)
    .where(and(eq(teams.orgId, orgId), eq(teams.slug, data.slug)))
    .limit(1);

  if (existing.length > 0) {
    return { error: "Slug already taken within this organization", status: 409 as const };
  }

  // Get org's drive folder ID
  const [org] = await db
    .select({ driveFolderId: organizations.driveFolderId })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  // Insert team record
  const [team] = await db
    .insert(teams)
    .values({
      orgId,
      name: data.name,
      slug: data.slug,
      createdBy: userId,
    })
    .returning();

  // Provision Drive subfolder under org's folder
  const token = await getAccessToken();
  if (token && org?.driveFolderId) {
    const workspace = await provisionWorkspace(
      token,
      data.name,
      org.driveFolderId
    );
    await db
      .update(teams)
      .set({ driveFolderId: workspace.folderId })
      .where(eq(teams.id, team.id));
    team.driveFolderId = workspace.folderId;
  }

  // Add creator as team admin
  await db.insert(memberships).values({
    userId,
    teamId: team.id,
    role: "admin",
  });

  return { team, status: 201 as const };
}

export async function updateTeam(
  teamId: string,
  data: z.infer<typeof updateTeamSchema>
) {
  const [updated] = await db
    .update(teams)
    .set(data)
    .where(eq(teams.id, teamId))
    .returning();

  return updated ?? null;
}

export async function deleteTeam(teamId: string) {
  await db.delete(memberships).where(eq(memberships.teamId, teamId));
  await db.delete(teams).where(eq(teams.id, teamId));
}
