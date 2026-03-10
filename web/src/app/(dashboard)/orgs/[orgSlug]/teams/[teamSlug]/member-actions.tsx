"use client";

import { useState } from "react";
import { updateMemberAction, removeMemberAction } from "@/lib/actions";

export function MemberActions({
  memberId,
  currentRole,
  path,
}: {
  memberId: string;
  currentRole: string;
  path: string;
}) {
  const [pending, setPending] = useState(false);

  const toggleRole = async () => {
    setPending(true);
    const newRole = currentRole === "admin" ? "member" : "admin";
    await updateMemberAction(memberId, newRole, path);
    setPending(false);
  };

  const remove = async () => {
    setPending(true);
    await removeMemberAction(memberId, path);
    setPending(false);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={toggleRole}
        disabled={pending}
        className="text-xs text-zinc-500 hover:text-zinc-700 disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        {currentRole === "admin" ? "Demote" : "Promote"}
      </button>
      <button
        onClick={remove}
        disabled={pending}
        className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300"
      >
        Remove
      </button>
    </div>
  );
}
