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
        const originalKeywords = this.extractKeywords(originalIssue);
        const joined = importantLines.join(" ").toLowerCase();
        const remainingMatches = originalKeywords.filter((kw) => joined.includes(kw));
        const resolved = remainingMatches.length === 0;
        let confidence;
        if (resolved && importantLines.length < 5) {
            confidence = "high";
        }
        else if (resolved) {
            confidence = "medium";
        }
        else {
            confidence = "low";
        }
        return {
            resolved,
            confidence,
            remaining_issues: resolved ? [] : [currentIssue],
            message: resolved
                ? `Issue appears resolved. No signs of "${originalIssue}" in current logs.`
                : `Issue may persist. Still detecting patterns related to "${originalIssue}".`,
        };
    }
    extractKeywords(issue) {
        return issue
            .toLowerCase()
            .split(/\s+/)
            .filter((w) => w.length > 3 && !["issue", "detected", "error", "unknown"].includes(w));
    }
}
exports.VerifierService = VerifierService;
