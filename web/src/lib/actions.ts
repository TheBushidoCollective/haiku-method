"use server";

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createOrg, createOrgSchema } from "@/lib/api/organizations";
import { createTeam, createTeamSchema } from "@/lib/api/teams";
import { addMember, addMemberSchema, updateMember, removeMember } from "@/lib/api/members";
import { getOrgBySlug, getTeamBySlug, isOrgAdmin, isTeamAdmin } from "@/lib/api/queries";
import { db } from "@/db";
import { memberships } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function createOrgAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const data = createOrgSchema.parse({
    name: formData.get("name"),
    slug: formData.get("slug"),
  });

  const result = await createOrg(session.user.id, data);
  if ("error" in result) {
    return { error: result.error };
  }

  redirect(`/orgs/${data.slug}`);
}

export async function createTeamAction(orgSlug: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const org = await getOrgBySlug(orgSlug);
  if (!org) return { error: "Organization not found" };

  const admin = await isOrgAdmin(org.id, session.user.id);
  if (!admin) throw new Error("Forbidden");

  const data = createTeamSchema.parse({
    name: formData.get("name"),
    slug: formData.get("slug"),
  });

  const result = await createTeam(org.id, session.user.id, data);
  if ("error" in result) {
    return { error: result.error };
  }

  redirect(`/orgs/${orgSlug}/teams/${data.slug}`);
}

export async function addMemberAction(
  orgSlug: string,
  teamSlug: string,
  formData: FormData
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const org = await getOrgBySlug(orgSlug);
  if (!org) return { error: "Organization not found" };

  const team = await getTeamBySlug(org.id, teamSlug);
  if (!team) return { error: "Team not found" };

  const admin = await isTeamAdmin(team.id, session.user.id);
  if (!admin) throw new Error("Forbidden");

  const data = addMemberSchema.parse({
    email: formData.get("email"),
    role: formData.get("role") || "member",
  });

  const result = await addMember(team.id, data);
  if ("error" in result) {
    return { error: result.error };
  }

  revalidatePath(`/orgs/${orgSlug}/teams/${teamSlug}`);
  return { success: true };
}

export async function updateMemberAction(
  memberId: string,
  role: "admin" | "member",
  path: string
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const [membership] = await db
    .select({ teamId: memberships.teamId })
    .from(memberships)
    .where(eq(memberships.id, memberId))
    .limit(1);
  if (!membership) return { error: "Membership not found" };

  const admin = await isTeamAdmin(membership.teamId, session.user.id);
  if (!admin) throw new Error("Forbidden");

  const result = await updateMember(memberId, { role });
  if ("error" in result) {
    return { error: result.error };
  }

  revalidatePath(path);
  return { success: true };
}

export async function removeMemberAction(memberId: string, path: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const [membership] = await db
    .select({ teamId: memberships.teamId })
    .from(memberships)
    .where(eq(memberships.id, memberId))
    .limit(1);
  if (!membership) return { error: "Membership not found" };

  const admin = await isTeamAdmin(membership.teamId, session.user.id);
  if (!admin) throw new Error("Forbidden");

  const result = await removeMember(memberId);
  if ("error" in result) {
    return { error: result.error };
  }

  revalidatePath(path);
  return { success: true };
}
