import crypto from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Request, Response } from "express";
import { authenticateRequest, McpAuthError } from "./auth";
import type { McpUser } from "./auth";
import { registerMemoryTools } from "./tools/memory";
import { registerSettingsTools } from "./tools/settings";
import { registerWorkspaceTools } from "./tools/workspace";
import { registerStateTools } from "./tools/state";
import { registerIntentTools } from "./tools/intents";
import { registerUnitTools } from "./tools/units";

function createMcpServer(user: McpUser, sessionId: string): McpServer {
  const server = new McpServer({
    name: "haiku-method",
    version: "1.0.0",
  });

  const getUser = () => user;
  const getSessionId = () => sessionId;

  registerMemoryTools(server, getUser);
  registerSettingsTools(server, getUser);
  registerWorkspaceTools(server, getUser);
  registerStateTools(server, getSessionId);
  registerIntentTools(server, getUser);
  registerUnitTools(server, getUser);

  return server;
}

export async function handleMcpRequest(req: Request, res: Response) {
  let user: McpUser;
  try {
    user = await authenticateRequest(req.headers.authorization);
  } catch (err) {
    if (err instanceof McpAuthError) {
      res.status(401).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: err.message },
        id: null,
      });
      return;
    }
    throw err;
  }

  const sessionId =
    (req.headers["mcp-session-id"] as string) || crypto.randomUUID();

  const server = createMcpServer(user, sessionId);

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => sessionId,
  });

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}

export async function handleMcpGet(_req: Request, res: Response) {
  res.status(405).json({
    jsonrpc: "2.0",
    error: {
      code: -32000,
      message: "Method not allowed. Use POST for MCP requests.",
    },
    id: null,
  });
}

export async function handleMcpDelete(_req: Request, res: Response) {
  res.status(200).json({
    jsonrpc: "2.0",
    result: {},
    id: null,
  });
}
