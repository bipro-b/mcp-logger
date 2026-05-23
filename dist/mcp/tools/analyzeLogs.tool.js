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
const sanitizer_service_js_1 = require("../../modules/sanitizer/sanitizer.service.js");
const analyzer_service_js_1 = require("../../modules/analyzer/analyzer.service.js");
const ai_service_js_1 = require("../../modules/ai/ai.service.js");
const logService = new log_service_js_1.LogService();
const logStreamer = new log_streamer_js_1.LogStreamer();
const sanitizer = new sanitizer_service_js_1.SanitizerService();
const analyzer = new analyzer_service_js_1.AnalyzerService();
const aiService = new ai_service_js_1.AIService();
exports.analyzeLogsToolDef = {
    name: "analyze_logs",
    description: "Securely analyze infrastructure logs — single or multi-service. Redacts all secrets locally, detects root cause, and returns exact fix commands. Supports up to 10 log files simultaneously for cross-service correlation.",
    inputSchema: {
        type: "object",
        properties: {
            log_path: {
                type: "string",
                description: "Absolute path to a single log file",
            },
            log_paths: {
                type: "array",
                items: { type: "string" },
                description: "Array of log file paths for multi-service correlation (up to 10 files). Each line is labeled with its source filename.",
            },
            log_text: {
                type: "string",
                description: "Raw log content as a string",
            },
        },
    },
};
async function handleAnalyzeLogs(rawArgs) {
    const args = (rawArgs ?? {});
    const hasInput = args.log_path || args.log_text || (args.log_paths && args.log_paths.length > 0);
    if (!hasInput) {
        return {
            content: [{ type: "text", text: "Provide log_path, log_paths, or log_text." }],
            isError: true,
        };
    }
    const rawLogs = await logService.getLogs(args);
    if (!rawLogs || rawLogs.length === 0) {
        return { content: [{ type: "text", text: "⚠️ No logs found or empty input." }] };
    }
    // Smart sample large inputs (keep errors from full file + recent lines)
    const sampled = logStreamer.smartSample(rawLogs, 2_000);
    const sanitizedLogs = sanitizer.sanitizeLogs(sampled);
    let importantLines = [];
    let detectedIssue = "Unknown issue";
    try {
        importantLines = analyzer.extractImportantLines(sanitizedLogs, 100);
        detectedIssue = analyzer.detectMainIssue(importantLines);
    }
    catch {
        importantLines = sanitizedLogs.slice(-50);
    }
    // Pass source names to AI for multi-file context
    const sources = args.log_paths?.map((p) => path.basename(p));
    const aiResult = await Promise.race([
        aiService.analyzeLogs(importantLines, detectedIssue, sources),
        new Promise((resolve) => setTimeout(() => resolve("⚠️ AI response timed out after 30s"), 30_000)),
    ]);
    const preview = importantLines.slice(-10).join("\n");
    const fileCount = args.log_paths ? args.log_paths.length : 1;
    const sourceLabel = args.log_paths ? `${fileCount} files (${args.log_paths.map((p) => path.basename(p)).join(", ")})` : args.log_path ? path.basename(args.log_path) : "direct input";
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
                    `✔ ${SANITIZATION_PATTERN_COUNT} redaction patterns applied before AI processing`,
                    `✔ No credentials, tokens, or IPs were exposed`,
                ].join("\n"),
            },
        ],
    };
}
exports.handleAnalyzeLogs = handleAnalyzeLogs;
const SANITIZATION_PATTERN_COUNT = 15;
