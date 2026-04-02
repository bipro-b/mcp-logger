"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = exports.createMCPServer = void 0;
const server_1 = require("@modelcontextprotocol/sdk/server");
const analyzeLogs_tool_1 = require("./tools/analyzeLogs.tool");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
function createMCPServer() {
    const server = new server_1.Server({
        name: "zerotrust-log-ai",
        version: "1.0.0",
    }, {
        capabilities: {
            tools: {},
        },
    });
    // Register tools
    (0, analyzeLogs_tool_1.registerAnalyzeLogsTool)(server);
    return server;
}
exports.createMCPServer = createMCPServer;
async function startServer() {
    const server = createMCPServer();
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.log("✅ MCP Server running via stdio");
}
exports.startServer = startServer;
