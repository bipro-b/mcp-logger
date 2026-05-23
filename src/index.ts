import * as dotenv from "dotenv";
dotenv.config({ quiet: true });

import { startServer } from "./mcp/mcpServer.js";

startServer().catch((err) => {
  process.stderr.write(`Server failed: ${err}\n`);
  process.exit(1);
});
