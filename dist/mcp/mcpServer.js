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
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const http = __importStar(require("http"));
const analyzeLogs_tool_js_1 = require("./tools/analyzeLogs.tool.js");
const executeFix_tool_js_1 = require("./tools/executeFix.tool.js");
const verifyResolution_tool_js_1 = require("./tools/verifyResolution.tool.js");
const incidentReport_tool_js_1 = require("./tools/incidentReport.tool.js");
const healthCheck_tool_js_1 = require("./tools/healthCheck.tool.js");
const logCompare_tool_js_1 = require("./tools/logCompare.tool.js");
const TOOLS = [
    analyzeLogs_tool_js_1.analyzeLogsToolDef,
    executeFix_tool_js_1.executeFixToolDef,
    verifyResolution_tool_js_1.verifyResolutionToolDef,
    incidentReport_tool_js_1.incidentReportToolDef,
    healthCheck_tool_js_1.healthCheckToolDef,
    logCompare_tool_js_1.logCompareToolDef,
];
function createMCPServer() {
    const server = new index_js_1.Server({ name: "zerotrust-log-ai", version: "2.0.0" }, { capabilities: { tools: {} } });
    server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => ({ tools: TOOLS }));
    server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
        const args = request.params.arguments;
        try {
            switch (request.params.name) {
                case "analyze_logs":
                    return await (0, analyzeLogs_tool_js_1.handleAnalyzeLogs)(args);
                case "execute_fix":
                    return await (0, executeFix_tool_js_1.handleExecuteFix)(args);
                case "verify_resolution":
                    return await (0, verifyResolution_tool_js_1.handleVerifyResolution)(args);
                case "incident_report":
                    return await (0, incidentReport_tool_js_1.handleIncidentReport)(args);
                case "health_check":
                    return await (0, healthCheck_tool_js_1.handleHealthCheck)(args);
                case "log_compare":
                    return await (0, logCompare_tool_js_1.handleLogCompare)(args);
                default:
                    return {
                        content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }],
                        isError: true,
                    };
            }
        }
        catch (err) {
            return {
                content: [
                    {
                        type: "text",
                        text: `❌ Tool error: ${err instanceof Error ? err.message : String(err)}`,
                    },
                ],
                isError: true,
            };
        }
    });
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
        process.stderr.write(`ZeroTrust Log AI v2.0 — MCP server on port ${port} (${TOOLS.length} tools)\n`);
    });
}
exports.startServer = startServer;
