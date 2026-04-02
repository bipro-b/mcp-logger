import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAnalyzeLogsTool } from "./tools/analyzeLogs.tool";

export function createMCPServer() {
  const server = new Server(
    { name: "zerotrust-log-ai", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );
  registerAnalyzeLogsTool(server);
  return server;
}

export async function startServer() {
  const server = createMCPServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr ONLY — stdout must be pure JSON-RPC
  process.stderr.write("MCP Server running via stdio\n");
}