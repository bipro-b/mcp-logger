import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerAnalyzeLogsTool } from "./tools/analyzeLogs.tool.js";
import * as http from "http";

export function createMCPServer() {
  const server = new Server(
    { name: "zerotrust-log-ai", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );
  registerAnalyzeLogsTool(server);
  return server;
}

export async function startServer() {
  const port = parseInt(process.env.PORT ?? "8080");

  const httpServer = http.createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/ping") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("pong");
      return;
    }

    if (req.url === "/" || req.url === "/mcp") {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });
      const server = createMCPServer();
      await server.connect(transport);
      await transport.handleRequest(req, res);
      return;
    }

    res.writeHead(405);
    res.end();
  });

  httpServer.listen(port, () => {
    process.stderr.write(`MCP HTTP server listening on port ${port}\n`);
  });
}