import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readSettings, writeSettings } from "../../lib/drive/workspace";
import { resolveWorkspace } from "../workspace-resolver";
import type { McpUser } from "../auth";

export function registerSettingsTools(
  server: McpServer,
  getUser: () => McpUser
) {
  server.tool(
    "settings_read",
    "Read workspace settings for the team",
    { team_slug: z.string() },
    async ({ team_slug }) => {
      const user = getUser();
      const workspace = await resolveWorkspace(user.id, team_slug);
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
    "Write workspace settings for the team",
    { team_slug: z.string(), content: z.string() },
    async ({ team_slug, content }) => {
      const user = getUser();
      const workspace = await resolveWorkspace(user.id, team_slug);
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
