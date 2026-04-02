"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startServer = exports.createMCPServer = void 0;
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const streamableHttp_js_1 = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const analyzeLogs_tool_js_1 = require("./tools/analyzeLogs.tool.js");
const http = __importStar(require("http"));
function createMCPServer() {
    const server = new index_js_1.Server({ name: "zerotrust-log-ai", version: "1.0.0" }, { capabilities: { tools: {} } });
    (0, analyzeLogs_tool_js_1.registerAnalyzeLogsTool)(server);
    return server;
}
exports.createMCPServer = createMCPServer;
async function startServer() {
    const port = parseInt(process.env.PORT ?? "8080");
    const httpServer = http.createServer(async (req, res) => {
        if (req.method === "GET" && req.url === "/ping") {
            res.writeHead(200, { "Content-Type": "text/plain" });
            res.end("pong");
            return;
        }
        if (req.url === "/" || req.url === "/mcp") {
            const transport = new streamableHttp_js_1.StreamableHTTPServerTransport({
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
exports.startServer = startServer;
