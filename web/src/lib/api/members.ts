import { z } from "zod";
import { db } from "@/db";
import { memberships, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export const addMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "member"]).default("member"),
});

export const updateMemberSchema = z.object({
  role: z.enum(["admin", "member"]),
});

export async function listMembers(teamId: string) {
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

export async function addMember(
  teamId: string,
  data: z.infer<typeof addMemberSchema>
) {
  // Find user by email
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, data.email))
    .limit(1);

  if (!user) {
    return { error: "User not found", status: 404 as const };
  }

  // Check if already a member
  const existing = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(eq(memberships.teamId, teamId), eq(memberships.userId, user.id))
    )
    .limit(1);

  if (existing.length > 0) {
    return { error: "User is already a member of this team", status: 409 as const };
  }

  const [membership] = await db
    .insert(memberships)
    .values({
      userId: user.id,
      teamId,
      role: data.role,
    })
    .returning();

  return { membership, status: 201 as const };
}

export async function updateMember(memberId: string, data: z.infer<typeof updateMemberSchema>) {
  // Get current membership
  const [current] = await db
    .select()
    .from(memberships)
    .where(eq(memberships.id, memberId))
    .limit(1);

  if (!current) {
    return { error: "Membership not found", status: 404 as const };
  }

  // If demoting from admin, ensure at least one admin remains
  if (current.role === "admin" && data.role === "member") {
    const adminCount = await db
      .select({ id: memberships.id })
      .from(memberships)
      .where(
        and(
          eq(memberships.teamId, current.teamId),
          eq(memberships.role, "admin")
        )
      );

    if (adminCount.length <= 1) {
      return { error: "Cannot remove the last admin", status: 400 as const };
    }
  }

  const [updated] = await db
    .update(memberships)
    .set({ role: data.role })
    .where(eq(memberships.id, memberId))
    .returning();

  return { membership: updated, status: 200 as const };
}

export async function removeMember(memberId: string) {
  const [current] = await db
    .select()
    .from(memberships)
    .where(eq(memberships.id, memberId))
    .limit(1);

  if (!current) {
    return { error: "Membership not found", status: 404 as const };
  }

  // Prevent removing last admin
  if (current.role === "admin") {
    const adminCount = await db
      .select({ id: memberships.id })
      .from(memberships)
      .where(
        and(
          eq(memberships.teamId, current.teamId),
          eq(memberships.role, "admin")
        )
      );

    if (adminCount.length <= 1) {
      return { error: "Cannot remove the last admin", status: 400 as const };
    }
  }

  await db.delete(memberships).where(eq(memberships.id, memberId));
  return { status: 204 as const };
}
