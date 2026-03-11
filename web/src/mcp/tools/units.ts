import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  createUnit,
  readUnit,
  writeUnit,
  listUnits,
  deleteUnit,
} from "../../lib/drive/workspace";
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

export function registerUnitTools(
  server: McpServer,
  getUser: () => McpUser
) {
  server.tool(
    "unit_create",
    "Create a unit file within an intent",
    {
      ...workspaceParams,
      intent_slug: z.string().describe("Slug of the parent intent"),
      unit_name: z.string().describe("File name for the unit (e.g., unit-01-name.md)"),
      content: z.string().describe("Markdown content for the unit file"),
    },
    async ({ workspace_type, slug, intent_slug, unit_name, content }) => {
      const user = getUser();
      const ws = await resolveWorkspace(user.id, user.accessToken, workspace_type, slug);
      await createUnit(user.accessToken, ws.driveFolderId, intent_slug, unit_name, content);
      return {
        content: [
          { type: "text" as const, text: `Unit "${unit_name}" created in intent "${intent_slug}".` },
        ],
      };
    }
  );

  server.tool(
    "unit_read",
    "Read a unit file from an intent",
    {
      ...workspaceParams,
      intent_slug: z.string().describe("Slug of the parent intent"),
      unit_name: z.string().describe("File name of the unit"),
    },
    async ({ workspace_type, slug, intent_slug, unit_name }) => {
      const user = getUser();
      const ws = await resolveWorkspace(user.id, user.accessToken, workspace_type, slug);
      const content = await readUnit(user.accessToken, ws.driveFolderId, intent_slug, unit_name);

      if (content === null) {
        return {
          content: [
            { type: "text" as const, text: `Unit "${unit_name}" not found in intent "${intent_slug}".` },
          ],
        };
      }

      return {
        content: [{ type: "text" as const, text: content }],
      };
    }
  );

  server.tool(
    "unit_write",
    "Update a unit file in an intent",
    {
      ...workspaceParams,
      intent_slug: z.string().describe("Slug of the parent intent"),
      unit_name: z.string().describe("File name of the unit"),
      content: z.string().describe("New markdown content for the unit file"),
    },
    async ({ workspace_type, slug, intent_slug, unit_name, content }) => {
      const user = getUser();
      const ws = await resolveWorkspace(user.id, user.accessToken, workspace_type, slug);
      await writeUnit(user.accessToken, ws.driveFolderId, intent_slug, unit_name, content);
      return {
        content: [
          { type: "text" as const, text: `Unit "${unit_name}" updated in intent "${intent_slug}".` },
        ],
      };
    }
  );

  server.tool(
    "unit_list",
    "List all unit files in an intent",
    {
      ...workspaceParams,
      intent_slug: z.string().describe("Slug of the parent intent"),
    },
    async ({ workspace_type, slug, intent_slug }) => {
      const user = getUser();
      const ws = await resolveWorkspace(user.id, user.accessToken, workspace_type, slug);
      const units = await listUnits(user.accessToken, ws.driveFolderId, intent_slug);

      if (units.length === 0) {
        return {
          content: [
            { type: "text" as const, text: `No units found in intent "${intent_slug}".` },
          ],
        };
      }

      return {
        content: [{ type: "text" as const, text: units.join("\n") }],
      };
    }
  );

  server.tool(
    "unit_delete",
    "Delete a unit file from an intent",
    {
      ...workspaceParams,
      intent_slug: z.string().describe("Slug of the parent intent"),
      unit_name: z.string().describe("File name of the unit"),
    },
    async ({ workspace_type, slug, intent_slug, unit_name }) => {
      const user = getUser();
      const ws = await resolveWorkspace(user.id, user.accessToken, workspace_type, slug);
      const deleted = await deleteUnit(user.accessToken, ws.driveFolderId, intent_slug, unit_name);

      return {
        content: [
          {
            type: "text" as const,
            text: deleted
              ? `Unit "${unit_name}" deleted from intent "${intent_slug}".`
              : `Unit "${unit_name}" not found in intent "${intent_slug}".`,
          },
        ],
      };
    }
  );
}
