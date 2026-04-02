"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAnalyzeLogsTool = void 0;
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const log_service_js_1 = require("../../modules/log/log.service.js");
const sanitizer_service_js_1 = require("../../modules/sanitizer/sanitizer.service.js");
const analyzer_service_js_1 = require("../../modules/analyzer/analyzer.service.js");
const ai_service_js_1 = require("../../modules/ai/ai.service.js");
const logService = new log_service_js_1.LogService();
const sanitizer = new sanitizer_service_js_1.SanitizerService();
const analyzer = new analyzer_service_js_1.AnalyzerService();
const aiService = new ai_service_js_1.AIService();
function registerAnalyzeLogsTool(server) {
    /**
     * 1. TOOL DISCOVERY
     */
    server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => ({
        tools: [
            {
                name: "analyze_logs",
                description: "Securely analyze logs, detect issues, and suggest fixes using AI without leaking secrets.",
                inputSchema: {
                    type: "object",
                    properties: {
                        log_path: {
                            type: "string",
                            description: "Local path to the log file",
                        },
                        log_text: {
                            type: "string",
                            description: "Direct log text input",
                        },
                    },
                },
            },
        ],
    }));
    /**
     * 2. TOOL EXECUTION
     */
    server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
        if (request.params.name !== "analyze_logs") {
            throw new Error("Unknown tool");
        }
        const args = (request.params.arguments || {});
        try {
            /**
             * STEP 1: LOAD LOGS
             */
            if (!args.log_path && !args.log_text) {
                return {
                    content: [
                        {
                            type: "text",
                            text: "Please provide either log_path or log_text",
                        },
                    ],
                    isError: true,
                };
            }
            const rawLogs = await logService.getLogs(args);
            if (!rawLogs || rawLogs.length === 0) {
                return {
                    content: [
                        {
                            type: "text",
                            text: "⚠️ No logs found or empty input.",
                        },
                    ],
                };
            }
            /**
             * STEP 2: SANITIZE 🔐
             */
            const MAX_LINES = 500;
            const trimmedLogs = rawLogs.slice(-MAX_LINES);
            const sanitizedLogs = sanitizer.sanitizeLogs(trimmedLogs);
            /**
             * STEP 3: ANALYZE 🧠
             */
            let importantLines = [];
            let detectedIssue = "Unknown issue";
            try {
                importantLines = analyzer.extractImportantLines(sanitizedLogs);
                detectedIssue = analyzer.detectMainIssue(importantLines);
            }
            catch {
                importantLines = sanitizedLogs.slice(-20);
            }
            /**
             * STEP 4: AI INSIGHTS 🤖
             */
            const aiResult = await Promise.race([
                aiService.analyzeLogs(importantLines, detectedIssue),
                new Promise((resolve) => setTimeout(() => resolve("⚠️ AI response timed out"), 5000)),
            ]);
            /**
             * STEP 5: FORMAT RESPONSE 🚀
             */
            const preview = importantLines.slice(-10).join("\n");
            return {
                content: [
                    {
                        type: "text",
                        text: `
🚨 Issue Detected:
${detectedIssue}

📊 Analysis Summary:
- Total Lines Processed: ${sanitizedLogs.length}
- Important Lines Found: ${importantLines.length}

🧾 Key Log Snippets:
${preview || "No critical lines found"}

${aiResult}

🔐 Security Guarantee:
✔ Emails, IPs, tokens, and secrets are automatically redacted
✔ No sensitive data is exposed to AI
            `,
                    },
                ],
            };
        }
        catch (err) {
            return {
                content: [
                    {
                        type: "text",
                        text: `❌ Analysis Failed: ${err.message}`,
                    },
                ],
                isError: true,
            };
        }
    });
}
exports.registerAnalyzeLogsTool = registerAnalyzeLogsTool;
