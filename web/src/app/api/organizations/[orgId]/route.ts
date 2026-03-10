import { NextResponse } from "next/server";
import { requireOrgMember, requireOrgAdmin } from "@/lib/api/auth";
import {
  getOrg,
  updateOrg,
  deleteOrg,
  updateOrgSchema,
} from "@/lib/api/organizations";

type Params = { params: Promise<{ orgId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { orgId } = await params;
  const userOrRes = await requireOrgMember(orgId);
  if (userOrRes instanceof NextResponse) return userOrRes;

  const org = await getOrg(orgId);
  if (!org) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(org);
}

export async function PATCH(request: Request, { params }: Params) {
  const { orgId } = await params;
  const userOrRes = await requireOrgAdmin(orgId);
  if (userOrRes instanceof NextResponse) return userOrRes;

  const body = await request.json();
  const parsed = updateOrgSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const updated = await updateOrg(orgId, parsed.data);
  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}

export async function DELETE(_request: Request, { params }: Params) {
  const { orgId } = await params;
  const userOrRes = await requireOrgAdmin(orgId);
  if (userOrRes instanceof NextResponse) return userOrRes;

  await deleteOrg(orgId);
  return new NextResponse(null, { status: 204 });
}
