import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import * as http from "http";

import { RateLimiter } from "../modules/ratelimit/ratelimit.service.js";
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

// 100 requests per hour per IP
const rateLimiter = new RateLimiter(100, 60);

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
    const args = request.params.arguments;
    try {
      switch (request.params.name) {
        case "analyze_logs":      return await handleAnalyzeLogs(args);
        case "execute_fix":       return await handleExecuteFix(args);
        case "verify_resolution": return await handleVerifyResolution(args);
        case "incident_report":   return await handleIncidentReport(args);
        case "health_check":      return await handleHealthCheck(args);
        case "log_compare":       return await handleLogCompare(args);
        default:
          return {
            content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }],
            isError: true,
          };
      }
    } catch (err) {
      return {
        content: [{
          type: "text",
          text: `❌ ${err instanceof Error ? err.message : String(err)}`,
        }],
        isError: true,
      };
    }
  });

  return server;
}

export async function startServer(): Promise<void> {
  const port = parseInt(process.env.PORT ?? "8080");

  const httpServer = http.createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/ping") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("pong");
      return;
    }

    if (req.url === "/" || req.url === "/mcp") {
      const ip = getClientIP(req);
      const limit = rateLimiter.check(ip);

      if (!limit.allowed) {
        res.writeHead(429, {
          "Content-Type": "application/json",
          "Retry-After": String(limit.retryAfter ?? 3600),
        });
        res.end(JSON.stringify({
          error: `Rate limit exceeded. Try again in ${limit.retryAfter}s.`,
        }));
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
      `ZeroTrust Log AI v2.0 — MCP server on port ${port} (${TOOLS.length} tools, rate-limited)\n`
    );
  });
}
