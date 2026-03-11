import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readSettings, writeSettings } from "../../lib/drive/workspace";
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

export function registerSettingsTools(
  server: McpServer,
  getUser: () => McpUser
) {
  server.tool(
    "settings_read",
    "Read workspace settings",
    { ...workspaceParams },
    async ({ workspace_type, slug }) => {
      const user = getUser();
      const workspace = await resolveWorkspace(user.id, user.accessToken, workspace_type, slug);
      const content = await readSettings(
        user.accessToken,
        workspace.driveFolderId
      );

      if (content === null) {
        return {
          content: [
            { type: "text" as const, text: "No settings file found." },
          ],
        };
      }

      return {
        content: [{ type: "text" as const, text: content }],
      };
    }
  );

  server.tool(
    "settings_write",
    "Write workspace settings",
    { ...workspaceParams, content: z.string() },
    async ({ workspace_type, slug, content }) => {
      const user = getUser();
      const workspace = await resolveWorkspace(user.id, user.accessToken, workspace_type, slug);
      await writeSettings(
        user.accessToken,
        workspace.driveFolderId,
        content
      );

      return {
        content: [
          { type: "text" as const, text: "Settings written successfully." },
        ],
      };
    }
  );
}
