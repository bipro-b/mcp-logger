"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mcpServer_1 = require("./mcp/mcpServer");
(0, mcpServer_1.startServer)().catch((err) => {
    // stderr only — stdout must remain clean for MCP JSON-RPC
    process.stderr.write(`Server failed: ${err}\n`);
    process.exit(1);
});
