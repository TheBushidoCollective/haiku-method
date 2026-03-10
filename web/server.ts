import express from "express";
import next from "next";
import {
  handleMcpRequest,
  handleMcpGet,
  handleMcpDelete,
} from "./src/mcp/server";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);

const nextApp = next({ dev });
const handle = nextApp.getRequestHandler();

nextApp.prepare().then(() => {
  const app = express();

  // MCP endpoint — parse JSON body for POST requests
  app.post("/mcp", express.json(), handleMcpRequest);
  app.get("/mcp", handleMcpGet);
  app.delete("/mcp", handleMcpDelete);

  // Delegate all other routes to Next.js
  app.all("*", (req, res) => {
    return handle(req, res);
  });

  app.listen(port, () => {
    console.log(
      `> Ready on http://localhost:${port} (${dev ? "development" : "production"})`
    );
  });
});
