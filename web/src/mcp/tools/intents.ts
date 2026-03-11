import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  createIntent,
  readIntent,
  writeIntent,
  listIntents,
  deleteIntent,
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

export function registerIntentTools(
  server: McpServer,
  getUser: () => McpUser
) {
  server.tool(
    "intent_create",
    "Create a new intent in a workspace",
    {
      ...workspaceParams,
      intent_slug: z.string().describe("Slug identifier for the intent"),
      content: z.string().describe("Markdown content for intent.md"),
    },
    async ({ workspace_type, slug, intent_slug, content }) => {
      const user = getUser();
      const ws = await resolveWorkspace(user.id, user.accessToken, workspace_type, slug);
      await createIntent(user.accessToken, ws.driveFolderId, intent_slug, content);
      return {
        content: [
          { type: "text" as const, text: `Intent "${intent_slug}" created.` },
        ],
      };
    }
  );

  server.tool(
    "intent_read",
    "Read an intent's content from a workspace",
    {
      ...workspaceParams,
      intent_slug: z.string().describe("Slug identifier for the intent"),
    },
    async ({ workspace_type, slug, intent_slug }) => {
      const user = getUser();
      const ws = await resolveWorkspace(user.id, user.accessToken, workspace_type, slug);
      const content = await readIntent(user.accessToken, ws.driveFolderId, intent_slug);

      if (content === null) {
        return {
          content: [
            { type: "text" as const, text: `Intent "${intent_slug}" not found.` },
          ],
        };
      }

      return {
        content: [{ type: "text" as const, text: content }],
      };
    }
  );

  server.tool(
    "intent_write",
    "Update an intent's content in a workspace",
    {
      ...workspaceParams,
      intent_slug: z.string().describe("Slug identifier for the intent"),
      content: z.string().describe("New markdown content for intent.md"),
    },
    async ({ workspace_type, slug, intent_slug, content }) => {
      const user = getUser();
      const ws = await resolveWorkspace(user.id, user.accessToken, workspace_type, slug);
      await writeIntent(user.accessToken, ws.driveFolderId, intent_slug, content);
      return {
        content: [
          { type: "text" as const, text: `Intent "${intent_slug}" updated.` },
        ],
      };
    }
  );

  server.tool(
    "intent_list",
    "List all intents in a workspace",
    { ...workspaceParams },
    async ({ workspace_type, slug }) => {
      const user = getUser();
      const ws = await resolveWorkspace(user.id, user.accessToken, workspace_type, slug);
      const intents = await listIntents(user.accessToken, ws.driveFolderId);

      if (intents.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No intents found." }],
        };
      }

      return {
        content: [{ type: "text" as const, text: intents.join("\n") }],
      };
    }
  );

  server.tool(
    "intent_delete",
    "Delete an intent and all its units from a workspace",
    {
      ...workspaceParams,
      intent_slug: z.string().describe("Slug identifier for the intent"),
    },
    async ({ workspace_type, slug, intent_slug }) => {
      const user = getUser();
      const ws = await resolveWorkspace(user.id, user.accessToken, workspace_type, slug);
      const deleted = await deleteIntent(user.accessToken, ws.driveFolderId, intent_slug);

      return {
        content: [
          {
            type: "text" as const,
            text: deleted
              ? `Intent "${intent_slug}" deleted.`
              : `Intent "${intent_slug}" not found.`,
          },
        ],
      };
    }
  );
}
