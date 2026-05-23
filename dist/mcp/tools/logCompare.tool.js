"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleLogCompare = exports.logCompareToolDef = void 0;
const log_service_js_1 = require("../../modules/log/log.service.js");
const log_streamer_js_1 = require("../../modules/log/log.streamer.js");
const sanitizer_service_js_1 = require("../../modules/sanitizer/sanitizer.service.js");
const analyzer_service_js_1 = require("../../modules/analyzer/analyzer.service.js");
const audit_service_js_1 = require("../../modules/audit/audit.service.js");
const logService = new log_service_js_1.LogService();
const logStreamer = new log_streamer_js_1.LogStreamer();
const sanitizer = new sanitizer_service_js_1.SanitizerService();
const analyzer = new analyzer_service_js_1.AnalyzerService();
exports.logCompareToolDef = {
    name: "log_compare",
    description: "Compare before and after logs to detect regressions or confirm fixes. Returns resolved errors, new errors introduced, and regression risk level.",
    inputSchema: {
        type: "object",
        properties: {
            before_text: {
                type: "string",
                description: "Log text from before the fix",
            },
            before_path: {
                type: "string",
                description: "Path to log file from before the fix",
            },
            after_text: {
                type: "string",
                description: "Log text from after the fix",
            },
            after_path: {
                type: "string",
                description: "Path to log file from after the fix",
            },
        },
    },
};
async function handleLogCompare(rawArgs) {
    const args = (rawArgs ?? {});
    if (!args.before_text && !args.before_path) {
        return {
            content: [{ type: "text", text: "Provide before_text or before_path." }],
            isError: true,
        };
    }
    if (!args.after_text && !args.after_path) {
        return {
            content: [{ type: "text", text: "Provide after_text or after_path." }],
            isError: true,
        };
    }
    const [beforeRaw, afterRaw] = await Promise.all([
        logService.getLogs({ log_text: args.before_text, log_path: args.before_path }),
        logService.getLogs({ log_text: args.after_text, log_path: args.after_path }),
    ]);
    const beforeErrors = new Set(analyzer
        .extractImportantLines(sanitizer.sanitizeLogs(logStreamer.foldStackTraces(beforeRaw.slice(-500))))
        .map(normalizeErrorLine));
    const afterErrors = new Set(analyzer
        .extractImportantLines(sanitizer.sanitizeLogs(logStreamer.foldStackTraces(afterRaw.slice(-500))))
        .map(normalizeErrorLine));
    const resolved = [...beforeErrors].filter((e) => !afterErrors.has(e));
    const newErrors = [...afterErrors].filter((e) => !beforeErrors.has(e));
    const unchanged = [...beforeErrors].filter((e) => afterErrors.has(e));
    const regressionRisk = newErrors.length >= 5
        ? "high"
        : newErrors.length >= 2
            ? "medium"
            : newErrors.length === 1
                ? "low"
                : "none";
    const riskEmoji = { high: "🔴", medium: "🟡", low: "🟠", none: "🟢" }[regressionRisk];
    const fmt = (arr, label, icon) => arr.length === 0
        ? `${icon} ${label}: none`
        : `${icon} ${label} (${arr.length}):\n${arr
            .slice(0, 10)
            .map((e) => `  • ${e}`)
            .join("\n")}`;
    const text = [
        `📊 Log Comparison — ${new Date().toISOString()}`,
        ``,
        `${riskEmoji} Regression Risk: ${regressionRisk.toUpperCase()}`,
        `Before: ${beforeErrors.size} error pattern(s) | After: ${afterErrors.size} error pattern(s)`,
        ``,
        fmt(resolved, "Resolved errors (fix confirmed)", "✅"),
        ``,
        fmt(newErrors, "NEW errors (regression risk)", "⚠️"),
        ``,
        fmt(unchanged, "Unchanged errors (still present)", "🔄"),
        ``,
        `🔐 All log content was locally redacted before analysis.`,
    ].join("\n");
    (0, audit_service_js_1.auditLog)({ tool: "log_compare", regression_risk: regressionRisk, success: true });
    return { content: [{ type: "text", text }] };
}
exports.handleLogCompare = handleLogCompare;
function normalizeErrorLine(line) {
    return line
        .replace(/\d+/g, "#")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120);
}
