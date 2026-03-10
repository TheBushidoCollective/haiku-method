import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import {
  listUserOrgs,
  createOrg,
  createOrgSchema,
} from "@/lib/api/organizations";

export async function GET() {
  const userOrRes = await requireAuth();
  if (userOrRes instanceof NextResponse) return userOrRes;

  const orgs = await listUserOrgs(userOrRes.id);
  return NextResponse.json(orgs);
}

export async function POST(request: Request) {
  const userOrRes = await requireAuth();
  if (userOrRes instanceof NextResponse) return userOrRes;

  const body = await request.json();
  const parsed = createOrgSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const result = await createOrg(userOrRes.id, parsed.data);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.org, { status: result.status });
}
