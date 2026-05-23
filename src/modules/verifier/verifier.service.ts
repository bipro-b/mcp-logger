import { LogService } from "../log/log.service.js";
import { SanitizerService } from "../sanitizer/sanitizer.service.js";
import { AnalyzerService } from "../analyzer/analyzer.service.js";
import type { VerificationResult } from "../../types/index.js";

const logService = new LogService();
const sanitizer = new SanitizerService();
const analyzer = new AnalyzerService();

export class VerifierService {
  async verify(
    originalIssue: string,
    input: { log_path?: string; log_text?: string }
  ): Promise<VerificationResult> {
    const rawLogs = await logService.getLogs(input);
    const sanitizedLogs = sanitizer.sanitizeLogs(rawLogs.slice(-500));
    const importantLines = analyzer.extractImportantLines(sanitizedLogs);
    const currentIssue = analyzer.detectMainIssue(importantLines);

    const originalKeywords = this.extractKeywords(originalIssue);
    const joined = importantLines.join(" ").toLowerCase();

    const remainingMatches = originalKeywords.filter((kw) => joined.includes(kw));
    const resolved = remainingMatches.length === 0;

    let confidence: "high" | "medium" | "low";
    if (resolved && importantLines.length < 5) {
      confidence = "high";
    } else if (resolved) {
      confidence = "medium";
    } else {
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

  private extractKeywords(issue: string): string[] {
    return issue
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3 && !["issue", "detected", "error", "unknown"].includes(w));
  }
}
