import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getWorkspaceInfo } from "../../lib/drive/workspace";
import { resolveWorkspace } from "../workspace-resolver";
import type { McpUser } from "../auth";

export function registerWorkspaceTools(
  server: McpServer,
  getUser: () => McpUser
) {
  server.tool(
    "workspace_info",
    "Get workspace information for a team including folder structure and metadata",
    { team_slug: z.string() },
    async ({ team_slug }) => {
      const user = getUser();
      const resolved = await resolveWorkspace(user.id, team_slug);
      const info = await getWorkspaceInfo(
        user.accessToken,
        resolved.driveFolderId
      );

      const result = {
        team: {
          id: resolved.teamId,
          name: resolved.teamName,
          slug: resolved.teamSlug,
          org_slug: resolved.orgSlug,
        },
        workspace: {
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
