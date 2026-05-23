"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleAnalyzeLogs = exports.analyzeLogsToolDef = void 0;
const log_service_js_1 = require("../../modules/log/log.service.js");
const sanitizer_service_js_1 = require("../../modules/sanitizer/sanitizer.service.js");
const analyzer_service_js_1 = require("../../modules/analyzer/analyzer.service.js");
const ai_service_js_1 = require("../../modules/ai/ai.service.js");
const logService = new log_service_js_1.LogService();
const sanitizer = new sanitizer_service_js_1.SanitizerService();
const analyzer = new analyzer_service_js_1.AnalyzerService();
const aiService = new ai_service_js_1.AIService();
exports.analyzeLogsToolDef = {
    name: "analyze_logs",
    description: "Securely analyze infrastructure logs, detect root cause, and suggest fix commands — without leaking secrets. All sensitive data is redacted locally before any AI processing.",
    inputSchema: {
        type: "object",
        properties: {
            log_path: { type: "string", description: "Absolute path to the log file" },
            log_text: { type: "string", description: "Raw log content as a string" },
        },
    },
};
async function handleAnalyzeLogs(rawArgs) {
    const args = (rawArgs ?? {});
    if (!args.log_path && !args.log_text) {
        return {
            content: [{ type: "text", text: "Please provide either log_path or log_text" }],
            isError: true,
        };
    }
    const rawLogs = await logService.getLogs(args);
    if (!rawLogs || rawLogs.length === 0) {
        return { content: [{ type: "text", text: "⚠️ No logs found or empty input." }] };
    }
    const sanitizedLogs = sanitizer.sanitizeLogs(rawLogs.slice(-500));
    let importantLines = [];
    let detectedIssue = "Unknown issue";
    try {
        importantLines = analyzer.extractImportantLines(sanitizedLogs);
        detectedIssue = analyzer.detectMainIssue(importantLines);
    }
    catch {
        importantLines = sanitizedLogs.slice(-20);
    }
    const aiResult = await Promise.race([
        aiService.analyzeLogs(importantLines, detectedIssue),
        new Promise((resolve) => setTimeout(() => resolve("⚠️ AI response timed out"), 30_000)),
    ]);
    const preview = importantLines.slice(-10).join("\n");
    return {
        content: [
            {
                type: "text",
                text: [
                    `🚨 Issue Detected:`,
                    detectedIssue,
                    ``,
                    `📊 Analysis Summary:`,
                    `- Total Lines Processed: ${sanitizedLogs.length}`,
                    `- Important Lines Found: ${importantLines.length}`,
                    ``,
                    `🧾 Key Log Snippets:`,
                    preview || "No critical lines found",
                    ``,
                    aiResult,
                    ``,
                    `🔐 Security Guarantee:`,
                    `✔ Emails, IPs, tokens, and secrets are automatically redacted`,
                    `✔ No sensitive data is exposed to AI`,
                ].join("\n"),
            },
        ],
    };
}
exports.handleAnalyzeLogs = handleAnalyzeLogs;
