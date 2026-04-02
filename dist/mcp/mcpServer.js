"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = exports.createMCPServer = void 0;
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const analyzeLogs_tool_js_1 = require("./tools/analyzeLogs.tool.js");
function createMCPServer() {
    const server = new index_js_1.Server({ name: "zerotrust-log-ai", version: "1.0.0" }, { capabilities: { tools: {} } });
    (0, analyzeLogs_tool_js_1.registerAnalyzeLogsTool)(server);
    return server;
}
exports.createMCPServer = createMCPServer;
async function startServer() {
    const server = createMCPServer();
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    // stderr ONLY — stdout must be pure JSON-RPC
    process.stderr.write("MCP Server running via stdio\n");
}
exports.startServer = startServer;
