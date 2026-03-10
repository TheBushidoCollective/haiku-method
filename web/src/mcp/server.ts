import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Request, Response } from "express";
import { authenticateRequest, McpAuthError } from "./auth";
import type { McpUser } from "./auth";
import { registerMemoryTools } from "./tools/memory";
import { registerSettingsTools } from "./tools/settings";
import { registerWorkspaceTools } from "./tools/workspace";

function createMcpServer(user: McpUser): McpServer {
  const server = new McpServer({
    name: "haiku-method",
    version: "1.0.0",
  });

  const getUser = () => user;

  registerMemoryTools(server, getUser);
  registerSettingsTools(server, getUser);
  registerWorkspaceTools(server, getUser);

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

  const server = createMcpServer(user);

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless mode
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
  // Stateless mode — no sessions to clean up
  res.status(200).json({
    jsonrpc: "2.0",
    result: {},
    id: null,
  });
}
