import { NextResponse } from "next/server";
import { requireTeamMember, requireTeamAdmin } from "@/lib/api/auth";
import {
  getTeam,
  updateTeam,
  deleteTeam,
  updateTeamSchema,
} from "@/lib/api/teams";

type Params = { params: Promise<{ orgId: string; teamId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { teamId } = await params;
  const userOrRes = await requireTeamMember(teamId);
  if (userOrRes instanceof NextResponse) return userOrRes;

  const team = await getTeam(teamId);
  if (!team) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(team);
}

export async function PATCH(request: Request, { params }: Params) {
  const { teamId } = await params;
  const userOrRes = await requireTeamAdmin(teamId);
  if (userOrRes instanceof NextResponse) return userOrRes;

  const body = await request.json();
  const parsed = updateTeamSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const updated = await updateTeam(teamId, parsed.data);
  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: Params) {
  const { teamId } = await params;
  const userOrRes = await requireTeamAdmin(teamId);
  if (userOrRes instanceof NextResponse) return userOrRes;

  await deleteTeam(teamId);
  return new NextResponse(null, { status: 204 });
}
