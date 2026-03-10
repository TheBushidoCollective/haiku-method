import express from "express";
import next from "next";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);

const nextApp = next({ dev });
const handle = nextApp.getRequestHandler();

nextApp.prepare().then(() => {
  const app = express();

  // Placeholder for MCP route (unit-05)
  app.use("/mcp", (_req, res) => {
    res.json({ status: "MCP endpoint placeholder" });
  });

  // Delegate all other routes to Next.js
  app.all("*", (req, res) => {
    return handle(req, res);
  });

  app.listen(port, () => {
    console.log(`> Ready on http://localhost:${port} (${dev ? "development" : "production"})`);
  });
});
