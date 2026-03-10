import { redirect } from "next/navigation";

type Params = {
  params: Promise<{ orgSlug: string; teamSlug: string }>;
};

export default async function MembersPage({ params }: Params) {
  const { orgSlug, teamSlug } = await params;
  redirect(`/orgs/${orgSlug}/teams/${teamSlug}`);
}
