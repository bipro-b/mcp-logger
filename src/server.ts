import { startServer } from "./mcp/mcpServer";

startServer().catch((err) => {
  // stderr only — stdout must remain clean for MCP JSON-RPC
  process.stderr.write(`Server failed: ${err}\n`);
  process.exit(1);
});