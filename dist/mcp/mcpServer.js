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
const crypto_1 = require("crypto");
const ratelimit_service_js_1 = require("../modules/ratelimit/ratelimit.service.js");
const metrics_service_js_1 = require("../modules/metrics/metrics.service.js");
const request_context_js_1 = require("../modules/audit/request-context.js");
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
const rateLimiter = new ratelimit_service_js_1.RateLimiter(100, 60);
// Health check cache — avoid hitting Gemini on every Cloud Run probe
let healthCache = null;
const HEALTH_TTL_MS = 30_000;
async function getHealth() {
    if (healthCache && Date.now() - healthCache.ts < HEALTH_TTL_MS) {
        return healthCache.result;
    }
    const checks = {
        memory_mb: String(Math.round(process.memoryUsage().heapUsed / 1024 / 1024)),
        uptime_s: String(Math.round(process.uptime())),
    };
    if (process.env.GEMINI_API_KEY) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3_000);
            const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`, { signal: controller.signal });
            clearTimeout(timeout);
            checks.ai = resp.ok ? "ok" : `error_${resp.status}`;
        }
        catch {
            checks.ai = "unreachable";
        }
    }
    else {
        checks.ai = "no_key_configured";
    }
    const ok = checks.ai === "ok" || checks.ai === "no_key_configured";
    const result = {
        status: ok ? "ok" : "degraded",
        version: "2.0.0",
        tools: TOOLS.length,
        checks,
        timestamp: new Date().toISOString(),
    };
    healthCache = { result, ts: Date.now() };
    return result;
}
function getClientIP(req) {
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string")
        return forwarded.split(",")[0].trim();
    return req.socket.remoteAddress ?? "unknown";
}
function createMCPServer() {
    const server = new index_js_1.Server({ name: "zerotrust-log-ai", version: "2.0.0" }, { capabilities: { tools: {} } });
    server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => ({ tools: TOOLS }));
    server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
        const toolName = request.params.name;
        const start = Date.now();
        let isError = false;
        return request_context_js_1.requestContext.run({ requestId: (0, crypto_1.randomUUID)() }, async () => {
            try {
                const args = request.params.arguments;
                let result;
                switch (toolName) {
                    case "analyze_logs":
                        result = await (0, analyzeLogs_tool_js_1.handleAnalyzeLogs)(args);
                        break;
                    case "execute_fix":
                        result = await (0, executeFix_tool_js_1.handleExecuteFix)(args);
                        break;
                    case "verify_resolution":
                        result = await (0, verifyResolution_tool_js_1.handleVerifyResolution)(args);
                        break;
                    case "incident_report":
                        result = await (0, incidentReport_tool_js_1.handleIncidentReport)(args);
                        break;
                    case "health_check":
                        result = await (0, healthCheck_tool_js_1.handleHealthCheck)(args);
                        break;
                    case "log_compare":
                        result = await (0, logCompare_tool_js_1.handleLogCompare)(args);
                        break;
                    default:
                        isError = true;
                        result = {
                            content: [{ type: "text", text: `Unknown tool: ${toolName}` }],
                            isError: true,
                        };
                }
                if (result.isError)
                    isError = true;
                return result;
            }
            catch (err) {
                isError = true;
                return {
                    content: [{
                            type: "text",
                            text: `❌ ${err instanceof Error ? err.message : String(err)}`,
                        }],
                    isError: true,
                };
            }
            finally {
                metrics_service_js_1.metrics.record(toolName, Date.now() - start, isError);
            }
        }); // requestContext.run
    });
    return server;
}
exports.createMCPServer = createMCPServer;
async function startServer() {
    const port = parseInt(process.env.PORT ?? "8080");
    const httpServer = http.createServer(async (req, res) => {
        // Health check — always 200 so Cloud Run keeps routing traffic
        // AI degraded = server still works, just without AI features
        if (req.method === "GET" && req.url === "/health") {
            const health = await getHealth();
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(health));
            return;
        }
        // Metrics — usage stats
        if (req.method === "GET" && req.url === "/metrics") {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(metrics_service_js_1.metrics.toJSON(), null, 2));
            return;
        }
        // Legacy ping
        if (req.method === "GET" && req.url === "/ping") {
            res.writeHead(200, { "Content-Type": "text/plain" });
            res.end("pong");
            return;
        }
        if (req.url === "/" || req.url === "/mcp") {
            const ip = getClientIP(req);
            const limit = rateLimiter.check(ip);
            if (!limit.allowed) {
                metrics_service_js_1.metrics.rateLimitHits++;
                res.writeHead(429, {
                    "Content-Type": "application/json",
                    "Retry-After": String(limit.retryAfter ?? 3600),
                });
                res.end(JSON.stringify({ error: `Rate limit exceeded. Retry in ${limit.retryAfter}s.` }));
                return;
            }
            res.setHeader("X-RateLimit-Remaining", String(limit.remaining));
            const transport = new streamableHttp_js_1.StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
            const server = createMCPServer();
            await server.connect(transport);
            await transport.handleRequest(req, res);
            return;
        }
        res.writeHead(404);
        res.end();
    });
    httpServer.listen(port, () => {
        process.stderr.write(`ZeroTrust Log AI v2.0 — port ${port} | ${TOOLS.length} tools | rate-limited | audit-logged\n`);
    });
    return httpServer;
}
exports.startServer = startServer;
