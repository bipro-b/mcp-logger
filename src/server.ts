import { startServer } from "./mcp/mcpServer";

startServer().catch((err) => {
  console.error("❌ Server failed:", err);
});