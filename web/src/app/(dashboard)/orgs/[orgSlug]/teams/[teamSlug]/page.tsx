import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import {
  getOrgBySlug,
  getTeamBySlug,
  getMembersForTeam,
  isTeamAdmin,
} from "@/lib/api/queries";
import { AddMemberForm } from "./add-member-form";
import { MemberActions } from "./member-actions";
import { CopyButton } from "./copy-button";

type Params = {
  params: Promise<{ orgSlug: string; teamSlug: string }>;
};

export default async function TeamPage({ params }: Params) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { orgSlug, teamSlug } = await params;
  const org = await getOrgBySlug(orgSlug);
  if (!org) notFound();

  const team = await getTeamBySlug(org.id, teamSlug);
  if (!team) notFound();

  const [members, admin] = await Promise.all([
    getMembersForTeam(team.id),
    isTeamAdmin(team.id, session.user.id),
  ]);

  const mcpCommand =
    "claude mcp add --transport http haiku https://haiku.railway.app/mcp";

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
        <Link
          href="/"
          className="hover:text-zinc-700 dark:hover:text-zinc-200"
        >
          Home
        </Link>
        <span>/</span>
        <Link
          href={`/orgs/${orgSlug}`}
          className="hover:text-zinc-700 dark:hover:text-zinc-200"
        >
          {org.name}
        </Link>
        <span>/</span>
        <span className="text-zinc-900 dark:text-zinc-50">{team.name}</span>
      </div>

      <h1 className="mt-4 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        {team.name}
      </h1>

      {/* Members */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
            Members
          </h2>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left dark:bg-zinc-800/50">
              <tr>
                <th className="px-4 py-2 font-medium text-zinc-500 dark:text-zinc-400">
                  Name
                </th>
                <th className="px-4 py-2 font-medium text-zinc-500 dark:text-zinc-400">
                  Email
                </th>
                <th className="px-4 py-2 font-medium text-zinc-500 dark:text-zinc-400">
                  Role
                </th>
                {admin && (
                  <th className="px-4 py-2 font-medium text-zinc-500 dark:text-zinc-400">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-900">
              {members.map((member) => (
                <tr key={member.id}>
                  <td className="px-4 py-3 text-zinc-900 dark:text-zinc-50">
                    {member.userName}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                    {member.userEmail}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        member.role === "admin"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                          : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                      }`}
                    >
                      {member.role}
                    </span>
                  </td>
                  {admin && (
                    <td className="px-4 py-3">
                      <MemberActions
                        memberId={member.id}
                        currentRole={member.role}
                        path={`/orgs/${orgSlug}/teams/${teamSlug}`}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {admin && (
          <div className="mt-4">
            <AddMemberForm orgSlug={orgSlug} teamSlug={teamSlug} />
          </div>
        )}
      </div>

      {/* Workspace Status */}
      <div className="mt-8 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
          Workspace Status
        </h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <dt className="text-zinc-500 dark:text-zinc-400">
              Drive folder:
            </dt>
            <dd>
              {team.driveFolderId ? (
                <span className="text-green-600 dark:text-green-400">
                  Provisioned
                </span>
              ) : (
                <span className="text-yellow-600 dark:text-yellow-400">
                  Pending
                </span>
              )}
            </dd>
          </div>
        </dl>
      </div>

      {/* Connect to Claude Code */}
      <div className="mt-8 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
          Connect to Claude Code
        </h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          Run this command in your terminal to connect Claude Code to the HAIKU
          MCP server:
        </p>
        <div className="mt-3 flex items-center gap-2">
          <pre className="flex-1 overflow-x-auto rounded-md bg-zinc-100 p-3 text-sm text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
            <code>{mcpCommand}</code>
          </pre>
          <CopyButton text={mcpCommand} />
        </div>
      </div>
    </div>
  );
}
