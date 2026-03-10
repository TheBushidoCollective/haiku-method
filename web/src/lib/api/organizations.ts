import { z } from "zod";
import { db } from "@/db";
import { organizations, teams, memberships } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getAccessToken } from "@/auth";
import { provisionWorkspace } from "@/lib/drive/workspace";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const createOrgSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(slugPattern, "Slug must be lowercase alphanumeric with hyphens"),
});

export const updateOrgSchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

export async function listUserOrgs(userId: string) {
  const rows = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      driveFolderId: organizations.driveFolderId,
      createdAt: organizations.createdAt,
    })
    .from(organizations)
    .innerJoin(teams, eq(teams.orgId, organizations.id))
    .innerJoin(memberships, eq(memberships.teamId, teams.id))
    .where(eq(memberships.userId, userId));

  // Deduplicate orgs (user may be in multiple teams within same org)
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

export async function getOrg(orgId: string) {
  const rows = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  return rows[0] ?? null;
}

export async function createOrg(
  userId: string,
  data: z.infer<typeof createOrgSchema>
) {
  // Check slug uniqueness
  const existing = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, data.slug))
    .limit(1);

  if (existing.length > 0) {
    return { error: "Slug already taken", status: 409 as const };
  }

  // Insert org record (drive_folder_id = null initially)
  const [org] = await db
    .insert(organizations)
    .values({
      name: data.name,
      slug: data.slug,
      createdBy: userId,
    })
    .returning();

  // Provision Drive workspace
  const token = await getAccessToken();
  if (token) {
    const workspace = await provisionWorkspace(token, data.name);
    await db
      .update(organizations)
      .set({ driveFolderId: workspace.folderId })
      .where(eq(organizations.id, org.id));
    org.driveFolderId = workspace.folderId;
  }

  // Create a default team for the org and add creator as admin
  const [defaultTeam] = await db
    .insert(teams)
    .values({
      orgId: org.id,
      name: "Default",
      slug: "default",
      createdBy: userId,
    })
    .returning();

  await db.insert(memberships).values({
    userId,
    teamId: defaultTeam.id,
    role: "admin",
  });

  return { org, status: 201 as const };
}

export async function updateOrg(
  orgId: string,
  data: z.infer<typeof updateOrgSchema>
) {
  const [updated] = await db
    .update(organizations)
    .set(data)
    .where(eq(organizations.id, orgId))
    .returning();

  return updated ?? null;
}

export async function deleteOrg(orgId: string) {
  // Delete memberships for all teams in the org
  const orgTeams = await db
    .select({ id: teams.id })
    .from(teams)
    .where(eq(teams.orgId, orgId));

  for (const team of orgTeams) {
    await db.delete(memberships).where(eq(memberships.teamId, team.id));
  }

  // Delete teams
  await db.delete(teams).where(eq(teams.orgId, orgId));

  // Delete org
  await db.delete(organizations).where(eq(organizations.id, orgId));
}
