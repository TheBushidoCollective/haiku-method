import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SessionStateStore } from "../state-store";

export function registerStateTools(
  server: McpServer,
  getSessionId: () => string
) {
  server.tool(
    "state_write",
    "Store a key-value pair in ephemeral session state (lost when session ends)",
    { key: z.string(), value: z.string() },
    async ({ key, value }) => {
      const sessionId = getSessionId();
      let parsed: unknown;
      try {
        parsed = JSON.parse(value);
      } catch {
        parsed = value;
      }
      SessionStateStore.set(sessionId, key, parsed);
      return {
        content: [{ type: "text" as const, text: `State key "${key}" written.` }],
      };
    }
  );

  server.tool(
    "state_read",
    "Read a value from ephemeral session state",
    { key: z.string() },
    async ({ key }) => {
      const sessionId = getSessionId();
      const value = SessionStateStore.get(sessionId, key);
      if (value === undefined) {
        return {
          content: [{ type: "text" as const, text: `Key "${key}" not found.` }],
        };
      }
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(value, null, 2) },
        ],
      };
    }
  );

  server.tool(
    "state_list",
    "List all keys in ephemeral session state",
    {},
    async () => {
      const sessionId = getSessionId();
      const keys = SessionStateStore.list(sessionId);
      if (keys.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No state entries." }],
        };
      }
      return {
        content: [{ type: "text" as const, text: keys.join("\n") }],
      };
    }
  );

  server.tool(
    "state_delete",
    "Delete a key from ephemeral session state",
    { key: z.string() },
    async ({ key }) => {
      const sessionId = getSessionId();
      const deleted = SessionStateStore.delete(sessionId, key);
      return {
        content: [
          {
            type: "text" as const,
            text: deleted
              ? `Key "${key}" deleted.`
              : `Key "${key}" not found.`,
          },
        ],
      };
    }
  );
}
