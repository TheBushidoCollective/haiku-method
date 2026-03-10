import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
  getOrgBySlug,
  getTeamsForOrg,
  isOrgAdmin,
} from "@/lib/api/queries";

type Params = { params: Promise<{ orgSlug: string }> };

export default async function OrgPage({ params }: Params) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { orgSlug } = await params;
  const org = await getOrgBySlug(orgSlug);
  if (!org) notFound();

  const [teamList, admin] = await Promise.all([
    getTeamsForOrg(org.id),
    isOrgAdmin(org.id, session.user.id),
  ]);

  return (
    <div>
      <Link
        href="/"
        className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        &larr; Organizations
      </Link>

      <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        {org.name}
      </h1>

      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
            Teams
          </h2>
          {admin && (
            <Link
              href={`/orgs/${orgSlug}/teams/new`}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Create Team
            </Link>
          )}
        </div>

        {teamList.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            No teams yet.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {teamList.map((team) => (
              <Link
                key={team.id}
                href={`/orgs/${orgSlug}/teams/${team.slug}`}
                className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
              >
                <div>
                  <h3 className="font-medium text-zinc-900 dark:text-zinc-50">
                    {team.name}
                  </h3>
                  <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                    {team.memberCount}{" "}
                    {team.memberCount === 1 ? "member" : "members"}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    team.driveFolderId
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                  }`}
                >
                  {team.driveFolderId ? "Provisioned" : "Pending"}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
          Settings
        </h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <dt className="text-zinc-500 dark:text-zinc-400">Slug:</dt>
            <dd className="font-mono text-zinc-900 dark:text-zinc-50">
              {org.slug}
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="text-zinc-500 dark:text-zinc-400">
              Drive folder:
            </dt>
            <dd className="text-zinc-900 dark:text-zinc-50">
              {org.driveFolderId ? (
                <span className="text-green-600 dark:text-green-400">
                  Connected
                </span>
              ) : (
                <span className="text-zinc-400 dark:text-zinc-500">
                  Not provisioned
                </span>
              )}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
