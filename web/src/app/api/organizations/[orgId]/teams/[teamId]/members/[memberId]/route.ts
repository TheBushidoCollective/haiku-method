import { NextResponse } from "next/server";
import { requireTeamAdmin } from "@/lib/api/auth";
import {
  updateMember,
  removeMember,
  updateMemberSchema,
} from "@/lib/api/members";
import { db } from "@/db";
import { memberships } from "@/db/schema";
import { eq } from "drizzle-orm";

type Params = {
  params: Promise<{ orgId: string; teamId: string; memberId: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  const { teamId, memberId } = await params;
  const userOrRes = await requireTeamAdmin(teamId);
  if (userOrRes instanceof NextResponse) return userOrRes;

  // Verify the membership belongs to this team
  const [membership] = await db
    .select({ teamId: memberships.teamId })
    .from(memberships)
    .where(eq(memberships.id, memberId))
    .limit(1);

  if (!membership || membership.teamId !== teamId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = updateMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const result = await updateMember(memberId, parsed.data);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.membership);
}

export async function DELETE(_request: Request, { params }: Params) {
  const { teamId, memberId } = await params;
  const userOrRes = await requireTeamAdmin(teamId);
  if (userOrRes instanceof NextResponse) return userOrRes;

  // Verify the membership belongs to this team
  const [membership] = await db
    .select({ teamId: memberships.teamId })
    .from(memberships)
    .where(eq(memberships.id, memberId))
    .limit(1);

  if (!membership || membership.teamId !== teamId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const result = await removeMember(memberId);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return new NextResponse(null, { status: 204 });
}
