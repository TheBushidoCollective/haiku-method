import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { users, teams, memberships, organizations } from "../db/schema";
import { provisionWorkspace } from "../lib/drive/workspace";

export type WorkspaceType = "user" | "team" | "org";

export interface ResolvedWorkspace {
  type: WorkspaceType;
  driveFolderId: string;
  label: string;
}

export class WorkspaceAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceAccessError";
  }
}

export async function resolveWorkspace(
  userId: string,
  accessToken: string,
  workspaceType: WorkspaceType,
  slug?: string
): Promise<ResolvedWorkspace> {
  switch (workspaceType) {
    case "user":
      return resolveUserWorkspace(userId, accessToken);
    case "team":
      return resolveTeamWorkspace(userId, slug);
    case "org":
      return resolveOrgWorkspace(userId, slug);
  }
}

async function resolveUserWorkspace(
  userId: string,
  accessToken: string
): Promise<ResolvedWorkspace> {
  const results = await db
    .select({ id: users.id, name: users.name, driveFolderId: users.driveFolderId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (results.length === 0) {
    throw new WorkspaceAccessError("User not found.");
  }

  const user = results[0];

  if (user.driveFolderId) {
    return {
      type: "user",
      driveFolderId: user.driveFolderId,
      label: `${user.name}'s workspace`,
    };
  }

  // Auto-provision: create .haiku folder in My Drive
  const info = await provisionWorkspace(accessToken, ".haiku", undefined);

  await db
    .update(users)
    .set({ driveFolderId: info.folderId })
    .where(eq(users.id, userId));

  return {
    type: "user",
    driveFolderId: info.folderId,
    label: `${user.name}'s workspace`,
  };
}

export async function resolveWorkspaceHierarchy(
  userId: string,
  accessToken: string,
  workspaceType: WorkspaceType,
  slug?: string
): Promise<ResolvedWorkspace[]> {
  switch (workspaceType) {
    case "user":
      return [await resolveUserWorkspace(userId, accessToken)];
    case "org":
      return [await resolveOrgWorkspace(userId, slug)];
    case "team": {
      const teamWs = await resolveTeamWorkspace(userId, slug);
      // Get the org slug from the team label (format: "orgSlug/teamSlug")
      const orgSlug = teamWs.label.split("/")[0];
      try {
        const orgWs = await resolveOrgWorkspace(userId, orgSlug);
        return [teamWs, orgWs];
      } catch {
        // Org workspace may not be provisioned
        return [teamWs];
      }
    }
  }
}

async function resolveTeamWorkspace(
  userId: string,
  slug?: string
): Promise<ResolvedWorkspace> {
  if (!slug) {
    throw new WorkspaceAccessError(
      "A slug is required for team workspaces."
    );
  }

  const results = await db
    .select({
      teamId: teams.id,
      teamName: teams.name,
      teamSlug: teams.slug,
      orgSlug: organizations.slug,
      driveFolderId: teams.driveFolderId,
      membershipId: memberships.id,
    })
    .from(teams)
    .innerJoin(organizations, eq(teams.orgId, organizations.id))
    .innerJoin(
      memberships,
      and(eq(memberships.teamId, teams.id), eq(memberships.userId, userId))
    )
    .where(eq(teams.slug, slug))
    .limit(1);

  if (results.length === 0) {
    throw new WorkspaceAccessError(
      `No team found with slug "${slug}" or you do not have access.`
    );
  }

  const row = results[0];

  if (!row.driveFolderId) {
    throw new WorkspaceAccessError(
      `Team "${slug}" has no workspace provisioned. Create one via the web app first.`
    );
  }

  return {
    type: "team",
    driveFolderId: row.driveFolderId,
    label: `${row.orgSlug}/${row.teamSlug}`,
  };
}

async function resolveOrgWorkspace(
  userId: string,
  slug?: string
): Promise<ResolvedWorkspace> {
  if (!slug) {
    throw new WorkspaceAccessError(
      "A slug is required for org workspaces."
    );
  }

  // Find org by slug
  const orgResults = await db
    .select({
      orgId: organizations.id,
      orgName: organizations.name,
      orgSlug: organizations.slug,
      driveFolderId: organizations.driveFolderId,
    })
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);

  if (orgResults.length === 0) {
    throw new WorkspaceAccessError(
      `No organization found with slug "${slug}".`
    );
  }

  const org = orgResults[0];

  // Verify user has membership in any team within this org
  const membershipResults = await db
    .select({ membershipId: memberships.id })
    .from(memberships)
    .innerJoin(teams, eq(memberships.teamId, teams.id))
    .where(
      and(eq(memberships.userId, userId), eq(teams.orgId, org.orgId))
    )
    .limit(1);

  if (membershipResults.length === 0) {
    throw new WorkspaceAccessError(
      `You do not have access to organization "${slug}".`
    );
  }

  if (!org.driveFolderId) {
    throw new WorkspaceAccessError(
      `Organization "${slug}" has no workspace provisioned. Create one via the web app first.`
    );
  }

  return {
    type: "org",
    driveFolderId: org.driveFolderId,
    label: org.orgSlug,
  };
}
