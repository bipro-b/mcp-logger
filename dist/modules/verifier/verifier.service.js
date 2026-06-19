"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerifierService = void 0;
const log_service_js_1 = require("../log/log.service.js");
const sanitizer_service_js_1 = require("../sanitizer/sanitizer.service.js");
const analyzer_service_js_1 = require("../analyzer/analyzer.service.js");
const logService = new log_service_js_1.LogService();
const sanitizer = new sanitizer_service_js_1.SanitizerService();
const analyzer = new analyzer_service_js_1.AnalyzerService();
class VerifierService {
    async verify(originalIssue, input) {
        const rawLogs = await logService.getLogs(input);
        const sanitizedLogs = sanitizer.sanitizeLogs(rawLogs.slice(-500));
        const importantLines = analyzer.extractImportantLines(sanitizedLogs);
        const currentIssue = analyzer.detectMainIssue(importantLines);
        // Empty logs after a fix almost always means the pod restarted — not a fix confirmation.
        if (rawLogs.length === 0) {
            return {
                resolved: false,
                confidence: "low",
                remaining_issues: ["No logs found — cannot verify"],
                message: "⚠️ No logs found. Provide logs written after the fix was applied.",
            };
        }
        const originalKeywords = this.extractKeywords(originalIssue);
        const joined = importantLines.join(" ").toLowerCase();
        const remainingMatches = originalKeywords.filter((kw) => joined.includes(kw));
        const resolved = originalKeywords.length > 0 && remainingMatches.length === 0;
        let confidence;
        let message;
        if (resolved) {
            if (importantLines.length === 0) {
                // Logs are fresh / pod restarted — cannot distinguish fix from restart
                confidence = "low";
                message = `Logs contain no error patterns, but log volume is very low (${rawLogs.length} lines). This may mean the process just restarted, not that the issue is fixed. Monitor for recurrence.`;
            }
            else if (importantLines.length < 10) {
                confidence = "medium";
                message = `No signs of "${originalIssue}" in current logs. Low error count — looks resolved but continue monitoring.`;
            }
            else {
                confidence = "high";
                message = `No signs of "${originalIssue}" found across ${importantLines.length} analyzed log entries. Issue appears resolved.`;
            }
        }
        else {
            confidence = "low";
            const found = remainingMatches.slice(0, 3).join(", ");
            message = `Issue patterns still present in logs (matched: ${found || "general error patterns"}). Fix may not have taken effect.`;
        }
        return {
            resolved,
            confidence,
            remaining_issues: resolved ? [] : [currentIssue],
            message,
        };
    }
    extractKeywords(issue) {
        // Short but meaningful ops terms that the 3-char filter would drop
        const ALWAYS_INCLUDE = new Set(["oom", "cpu", "dns", "tls", "ssl", "tcp", "udp"]);
        const STOP_WORDS = new Set(["issue", "detected", "error", "unknown", "requires", "deeper", "analysis", "failure"]);
        return issue
            .toLowerCase()
            .split(/\s+/)
            .filter((w) => (w.length >= 3 && !STOP_WORDS.has(w)) || ALWAYS_INCLUDE.has(w));
    }
}
exports.VerifierService = VerifierService;
