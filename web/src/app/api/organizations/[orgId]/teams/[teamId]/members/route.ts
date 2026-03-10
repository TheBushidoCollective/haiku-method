import { NextResponse } from "next/server";
import { requireTeamMember, requireTeamAdmin } from "@/lib/api/auth";
import {
  listMembers,
  addMember,
  addMemberSchema,
} from "@/lib/api/members";

type Params = {
  params: Promise<{ orgId: string; teamId: string }>;
};

export async function GET(_request: Request, { params }: Params) {
  const { teamId } = await params;
  const userOrRes = await requireTeamMember(teamId);
  if (userOrRes instanceof NextResponse) return userOrRes;

  const members = await listMembers(teamId);
  return NextResponse.json(members);
}

export async function POST(request: Request, { params }: Params) {
  const { teamId } = await params;
  const userOrRes = await requireTeamAdmin(teamId);
  if (userOrRes instanceof NextResponse) return userOrRes;

  const body = await request.json();
  const parsed = addMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const result = await addMember(teamId, parsed.data);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.membership, { status: result.status });
}
