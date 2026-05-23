import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import * as http from "http";
import { randomUUID } from "crypto";

import { RateLimiter } from "../modules/ratelimit/ratelimit.service.js";
import { metrics } from "../modules/metrics/metrics.service.js";
import { requestContext } from "../modules/audit/request-context.js";
import { analyzeLogsToolDef, handleAnalyzeLogs } from "./tools/analyzeLogs.tool.js";
import { executeFixToolDef, handleExecuteFix } from "./tools/executeFix.tool.js";
import { verifyResolutionToolDef, handleVerifyResolution } from "./tools/verifyResolution.tool.js";
import { incidentReportToolDef, handleIncidentReport } from "./tools/incidentReport.tool.js";
import { healthCheckToolDef, handleHealthCheck } from "./tools/healthCheck.tool.js";
import { logCompareToolDef, handleLogCompare } from "./tools/logCompare.tool.js";

const TOOLS = [
  analyzeLogsToolDef,
  executeFixToolDef,
  verifyResolutionToolDef,
  incidentReportToolDef,
  healthCheckToolDef,
  logCompareToolDef,
];

const rateLimiter = new RateLimiter(100, 60);

// Health check cache — avoid hitting Gemini on every Cloud Run probe
let healthCache: { result: Record<string, unknown>; ts: number } | null = null;
const HEALTH_TTL_MS = 30_000;

async function getHealth(): Promise<Record<string, unknown>> {
  if (healthCache && Date.now() - healthCache.ts < HEALTH_TTL_MS) {
    return healthCache.result;
  }

  const checks: Record<string, string> = {
    memory_mb: String(Math.round(process.memoryUsage().heapUsed / 1024 / 1024)),
    uptime_s: String(Math.round(process.uptime())),
  };

  if (process.env.GEMINI_API_KEY) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3_000);
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`,
        { signal: controller.signal }
      );
      clearTimeout(timeout);
      checks.ai = resp.ok ? "ok" : `error_${resp.status}`;
    } catch {
      checks.ai = "unreachable";
    }
  } else {
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

function getClientIP(req: http.IncomingMessage): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.socket.remoteAddress ?? "unknown";
}

export function createMCPServer(): Server {
  const server = new Server(
    { name: "zerotrust-log-ai", version: "2.0.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    const start = Date.now();
    let isError = false;

    return requestContext.run({ requestId: randomUUID() }, async () => {
    try {
      const args = request.params.arguments;
      let result;

      switch (toolName) {
        case "analyze_logs":      result = await handleAnalyzeLogs(args); break;
        case "execute_fix":       result = await handleExecuteFix(args); break;
        case "verify_resolution": result = await handleVerifyResolution(args); break;
        case "incident_report":   result = await handleIncidentReport(args); break;
        case "health_check":      result = await handleHealthCheck(args); break;
        case "log_compare":       result = await handleLogCompare(args); break;
        default:
          isError = true;
          result = {
            content: [{ type: "text", text: `Unknown tool: ${toolName}` }],
            isError: true,
          };
      }

      if (result.isError) isError = true;
      return result;
    } catch (err) {
      isError = true;
      return {
        content: [{
          type: "text",
          text: `❌ ${err instanceof Error ? err.message : String(err)}`,
        }],
        isError: true,
      };
    } finally {
      metrics.record(toolName, Date.now() - start, isError);
    }
    }); // requestContext.run
  });

  return server;
}

export async function startServer(): Promise<http.Server> {
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
      res.end(JSON.stringify(metrics.toJSON(), null, 2));
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
        metrics.rateLimitHits++;
        res.writeHead(429, {
          "Content-Type": "application/json",
          "Retry-After": String(limit.retryAfter ?? 3600),
        });
        res.end(JSON.stringify({ error: `Rate limit exceeded. Retry in ${limit.retryAfter}s.` }));
        return;
      }

      res.setHeader("X-RateLimit-Remaining", String(limit.remaining));

      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      const server = createMCPServer();
      await server.connect(transport);
      await transport.handleRequest(req, res);
      return;
    }

    res.writeHead(404);
    res.end();
  });

  httpServer.listen(port, () => {
    process.stderr.write(
      `ZeroTrust Log AI v2.0 — port ${port} | ${TOOLS.length} tools | rate-limited | audit-logged\n`
    );
  });

  return httpServer;
}
