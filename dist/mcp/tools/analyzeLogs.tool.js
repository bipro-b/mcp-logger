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
exports.handleAnalyzeLogs = exports.analyzeLogsToolDef = void 0;
const path = __importStar(require("path"));
const log_service_js_1 = require("../../modules/log/log.service.js");
const log_streamer_js_1 = require("../../modules/log/log.streamer.js");
const log_formatter_js_1 = require("../../modules/log/log.formatter.js");
const sanitizer_service_js_1 = require("../../modules/sanitizer/sanitizer.service.js");
const analyzer_service_js_1 = require("../../modules/analyzer/analyzer.service.js");
const ai_service_js_1 = require("../../modules/ai/ai.service.js");
const input_validator_js_1 = require("../../modules/validation/input.validator.js");
const logService = new log_service_js_1.LogService();
const logStreamer = new log_streamer_js_1.LogStreamer();
const sanitizer = new sanitizer_service_js_1.SanitizerService();
const analyzer = new analyzer_service_js_1.AnalyzerService();
const aiService = new ai_service_js_1.AIService();
exports.analyzeLogsToolDef = {
    name: "analyze_logs",
    description: "Securely analyze infrastructure logs. Redacts all secrets locally before any AI processing. Supports plain text, JSON structured logs, .gz compressed files, HTTP/HTTPS URLs (presigned S3/GCS), and up to 10 simultaneous log files for cross-service correlation.",
    inputSchema: {
        type: "object",
        properties: {
            log_path: {
                type: "string",
                description: "Absolute path to a log file (.log or .gz)",
            },
            log_paths: {
                type: "array",
                items: { type: "string" },
                description: "Multiple log file paths for cross-service correlation (up to 10). Lines are labeled with filename and sorted by timestamp.",
            },
            log_text: {
                type: "string",
                description: "Raw log content as a string (max 5MB)",
            },
            log_url: {
                type: "string",
                description: "HTTP/HTTPS URL to fetch logs from — supports presigned S3 URLs, GCS signed URLs, or any endpoint returning plain text logs (max 5MB)",
            },
            kubectl_log: {
                type: "object",
                description: "Fetch logs directly from a Kubernetes pod (requires kubectl configured on this machine — self-hosted mode only)",
                properties: {
                    pod: { type: "string", description: "Pod name" },
                    namespace: { type: "string", description: "Kubernetes namespace" },
                    container: { type: "string", description: "Container name (optional)" },
                    tail: { type: "number", description: "Number of lines to fetch (default 500, max 5000)" },
                },
                required: ["pod", "namespace"],
            },
        },
    },
};
async function handleAnalyzeLogs(rawArgs) {
    const args = (rawArgs ?? {});
    const hasInput = args.log_path ||
        args.log_text ||
        args.log_url ||
        args.kubectl_log ||
        (args.log_paths && args.log_paths.length > 0);
    if (!hasInput) {
        return {
            content: [{ type: "text", text: "Provide one of: log_path, log_paths, log_text, log_url, or kubectl_log." }],
            isError: true,
        };
    }
    const validationError = (0, input_validator_js_1.validateLogInput)({
        log_text: args.log_text,
        log_paths: args.log_paths,
    });
    if (validationError) {
        return { content: [{ type: "text", text: `❌ ${validationError}` }], isError: true };
    }
    const rawLogs = await logService.getLogs(args);
    if (!rawLogs || rawLogs.length === 0) {
        return { content: [{ type: "text", text: "⚠️ No logs found or empty input." }] };
    }
    // Pipeline: smart sample → parse JSON lines → redact secrets → analyze
    const sampled = logStreamer.smartSample(rawLogs, 2_000);
    const formatted = (0, log_formatter_js_1.formatLogLines)(sampled);
    const sanitizedLogs = sanitizer.sanitizeLogs(formatted);
    let importantLines = [];
    let detectedIssue = "Unknown issue";
    try {
        importantLines = analyzer.extractImportantLines(sanitizedLogs, 100);
        detectedIssue = analyzer.detectMainIssue(importantLines);
    }
    catch {
        importantLines = sanitizedLogs.slice(-50);
    }
    const sources = args.log_paths?.map((p) => path.basename(p));
    const aiResult = await Promise.race([
        aiService.analyzeLogs(importantLines, detectedIssue, sources),
        new Promise((resolve) => setTimeout(() => resolve("⚠️ AI response timed out after 30s"), 30_000)),
    ]);
    const preview = importantLines.slice(-10).join("\n");
    let sourceLabel = "direct input";
    if (args.log_paths)
        sourceLabel = `${args.log_paths.length} files — ${args.log_paths.map((p) => path.basename(p)).join(", ")}`;
    else if (args.log_path)
        sourceLabel = path.basename(args.log_path);
    else if (args.log_url)
        sourceLabel = `remote URL`;
    else if (args.kubectl_log)
        sourceLabel = `kubectl: ${args.kubectl_log.pod} (${args.kubectl_log.namespace})`;
    return {
        content: [
            {
                type: "text",
                text: [
                    `🚨 Issue Detected: ${detectedIssue}`,
                    ``,
                    `📊 Analysis Summary:`,
                    `- Source: ${sourceLabel}`,
                    `- Lines Ingested: ${rawLogs.length} → Sampled: ${sampled.length} → Important: ${importantLines.length}`,
                    ``,
                    `🧾 Key Log Snippets:`,
                    preview || "No critical lines found",
                    ``,
                    aiResult,
                    ``,
                    `🔐 Security:`,
                    `✔ 16 redaction patterns applied (AWS keys, DB URLs, tokens, passwords, IPs, IPv6, and more)`,
                    `✔ No credentials were sent to AI`,
                ].join("\n"),
            },
        ],
    };
}
exports.handleAnalyzeLogs = handleAnalyzeLogs;
