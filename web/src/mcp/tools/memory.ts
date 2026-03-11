import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readMemory, writeMemory, listMemory } from "../../lib/drive/workspace";
import { resolveWorkspace } from "../workspace-resolver";
import type { McpUser } from "../auth";

const workspaceParams = {
  workspace_type: z
    .enum(["user", "team", "org"])
    .describe("Type of workspace: user (personal), team, or org"),
  slug: z
    .string()
    .optional()
    .describe("Team or org slug. Required for team/org workspaces, ignored for user."),
};

export function registerMemoryTools(
  server: McpServer,
  getUser: () => McpUser
) {
  server.tool(
    "memory_read",
    "Read a memory file from a workspace",
    { ...workspaceParams, name: z.string() },
    async ({ workspace_type, slug, name }) => {
      const user = getUser();
      const workspace = await resolveWorkspace(user.id, user.accessToken, workspace_type, slug);
      const content = await readMemory(
        user.accessToken,
        workspace.driveFolderId,
        name
      );

      if (content === null) {
        return {
          content: [
            { type: "text" as const, text: `Memory file "${name}" not found.` },
          ],
        };
      }

      return {
        content: [{ type: "text" as const, text: content }],
      };
    }
  );

  server.tool(
    "memory_write",
    "Write content to a memory file in a workspace",
    {
      ...workspaceParams,
      name: z.string(),
      content: z.string(),
      mode: z.enum(["overwrite", "append"]).default("overwrite"),
    },
    async ({ workspace_type, slug, name, content, mode }) => {
      const user = getUser();
      const workspace = await resolveWorkspace(user.id, user.accessToken, workspace_type, slug);
      await writeMemory(
        user.accessToken,
        workspace.driveFolderId,
        name,
        content,
        mode
      );

      return {
        content: [
          {
            type: "text" as const,
            text: `Memory file "${name}" ${mode === "append" ? "appended" : "written"} successfully.`,
          },
        ],
      };
    }
  );

  server.tool(
    "memory_list",
    "List all memory files in a workspace",
    { ...workspaceParams },
    async ({ workspace_type, slug }) => {
      const user = getUser();
      const workspace = await resolveWorkspace(user.id, user.accessToken, workspace_type, slug);
      const files = await listMemory(
        user.accessToken,
        workspace.driveFolderId
      );

      if (files.length === 0) {
        return {
          content: [
            { type: "text" as const, text: "No memory files found." },
          ],
        };
      }

      return {
        content: [
          { type: "text" as const, text: files.join("\n") },
        ],
      };
    }
  );
}
