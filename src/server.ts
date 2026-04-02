import { startServer } from "./mcp/mcpServer.js";

startServer().catch((err) => {
  process.stderr.write(`Server failed: ${err}\n`);
  process.exit(1);
});