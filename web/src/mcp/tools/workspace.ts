import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getWorkspaceInfo } from "../../lib/drive/workspace";
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

export function registerWorkspaceTools(
  server: McpServer,
  getUser: () => McpUser
) {
  server.tool(
    "workspace_info",
    "Get workspace information including folder structure and metadata",
    { ...workspaceParams },
    async ({ workspace_type, slug }) => {
      const user = getUser();
      const resolved = await resolveWorkspace(user.id, user.accessToken, workspace_type, slug);
      const info = await getWorkspaceInfo(
        user.accessToken,
        resolved.driveFolderId
      );

      const result = {
        workspace: {
          type: resolved.type,
          label: resolved.label,
          drive_folder_id: info.folderId,
          memory_folder_id: info.memoryFolderId,
          settings_file_id: info.settingsFileId,
          memory_files: info.memoryFiles,
        },
      };

      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    }
  );
}
