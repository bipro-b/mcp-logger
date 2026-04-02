"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mcpServer_js_1 = require("./mcp/mcpServer.js");
(0, mcpServer_js_1.startServer)().catch((err) => {
    process.stderr.write(`Server failed: ${err}\n`);
    process.exit(1);
});
