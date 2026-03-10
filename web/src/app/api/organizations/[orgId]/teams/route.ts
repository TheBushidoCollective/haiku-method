import { NextResponse } from "next/server";
import { requireOrgMember, requireOrgAdmin } from "@/lib/api/auth";
import {
  listTeams,
  createTeam,
  createTeamSchema,
} from "@/lib/api/teams";

type Params = { params: Promise<{ orgId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { orgId } = await params;
  const userOrRes = await requireOrgMember(orgId);
  if (userOrRes instanceof NextResponse) return userOrRes;

  const teamList = await listTeams(orgId);
  return NextResponse.json(teamList);
}

export async function POST(request: Request, { params }: Params) {
  const { orgId } = await params;
  const userOrRes = await requireOrgAdmin(orgId);
  if (userOrRes instanceof NextResponse) return userOrRes;

  const body = await request.json();
  const parsed = createTeamSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const result = await createTeam(orgId, userOrRes.id, parsed.data);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.team, { status: result.status });
}
