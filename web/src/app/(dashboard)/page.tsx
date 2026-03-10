import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getOrgsForUser } from "@/lib/api/queries";

export default async function DashboardHome() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const orgs = await getOrgsForUser(session.user.id);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Organizations
        </h1>
        <Link
          href="/orgs/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Create Organization
        </Link>
      </div>

      {orgs.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="text-zinc-500 dark:text-zinc-400">
            You are not a member of any organizations yet.
          </p>
          <p className="mt-1 text-sm text-zinc-400 dark:text-zinc-500">
            Create one to get started.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {orgs.map((org) => (
            <Link
              key={org.id}
              href={`/orgs/${org.slug}`}
              className="block rounded-lg border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-medium text-zinc-900 dark:text-zinc-50">
                    {org.name}
                  </h2>
                  <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                    /{org.slug}
                  </p>
                </div>
                <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  {org.role}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
