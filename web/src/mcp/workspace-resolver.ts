import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { teams, memberships, organizations } from "../db/schema";

export interface ResolvedWorkspace {
  teamId: string;
  teamName: string;
  orgSlug: string;
  teamSlug: string;
  driveFolderId: string;
}

export class WorkspaceAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceAccessError";
  }
}

export async function resolveWorkspace(
  userId: string,
  teamSlug: string
): Promise<ResolvedWorkspace> {
  // Find teams matching the slug that the user is a member of
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
    .where(eq(teams.slug, teamSlug))
    .limit(1);

  if (results.length === 0) {
    throw new WorkspaceAccessError(
      `No team found with slug "${teamSlug}" or you do not have access.`
    );
  }

  const row = results[0];

  if (!row.driveFolderId) {
    throw new WorkspaceAccessError(
      `Team "${teamSlug}" has no workspace provisioned. Create one via the web app first.`
    );
  }

  return {
    teamId: row.teamId,
    teamName: row.teamName,
    orgSlug: row.orgSlug,
    teamSlug: row.teamSlug,
    driveFolderId: row.driveFolderId,
  };
}
