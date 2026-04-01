export class AnalyzerService {
  private ERROR_KEYWORDS = [
    "error",
    "fail",
    "failed",
    "exception",
    "panic",
    "fatal",
    "timeout",
    "refused",
    "crash",
  ];

  /**
   * Extract important log lines
   */
  extractImportantLines(logs: string[], maxLines = 50): string[] {
    const important: string[] = [];

    for (const line of logs) {
      const lower = line.toLowerCase();

      if (this.ERROR_KEYWORDS.some((keyword) => lower.includes(keyword))) {
        important.push(line);
      }
    }

    // fallback if nothing found
    if (important.length === 0) {
      return logs.slice(-50);
    }

    return important.slice(-maxLines);
  }

  /**
   * Detect main issue (simple heuristic)
   */
  detectMainIssue(lines: string[]): string {
    const joined = lines.join(" ").toLowerCase();

    if (joined.includes("timeout")) return "Timeout issue detected";
    if (joined.includes("connection refused"))
      return "Connection refused (service may be down)";
    if (joined.includes("null"))
      return "Possible null/undefined reference error";
    if (joined.includes("database"))
      return "Database-related issue";
    if (joined.includes("permission"))
      return "Permission or authentication issue";

    return "Unknown issue — requires deeper analysis";
  }
}