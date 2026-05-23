import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import * as http from "http";

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
        case "analyze_logs":
          return await handleAnalyzeLogs(args);
        case "execute_fix":
          return await handleExecuteFix(args);
        case "verify_resolution":
          return await handleVerifyResolution(args);
        case "incident_report":
          return await handleIncidentReport(args);
        case "health_check":
          return await handleHealthCheck(args);
        case "log_compare":
          return await handleLogCompare(args);
        default:
          return {
            content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }],
            isError: true,
          };
      }
    } catch (err) {
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

export async function startServer(): Promise<void> {
  const port = parseInt(process.env.PORT ?? "8080");

  const httpServer = http.createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/ping") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("pong");
      return;
    }

    if (req.url === "/" || req.url === "/mcp") {
      const transport = new StreamableHTTPServerTransport({
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
    process.stderr.write(
      `ZeroTrust Log AI v2.0 — MCP server on port ${port} (${TOOLS.length} tools)\n`
    );
  });
}
