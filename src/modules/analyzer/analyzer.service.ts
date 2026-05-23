interface ScoredLine {
  line: string;
  index: number;
  score: number;
}

const SEVERITY_RULES: Array<{ regex: RegExp; score: number }> = [
  { regex: /\b(fatal|panic|critical|emergency)\b/i, score: 10 },
  { regex: /\b(oom|out of memory|memory limit exceeded|killed)\b/i, score: 9 },
  { regex: /\b(disk full|no space left on device|enospc)\b/i, score: 9 },
  { regex: /\b(segfault|sigsegv|sigkill|core dump)\b/i, score: 8 },
  { regex: /\b(evicted|oomkilled)\b/i, score: 8 },
  { regex: /\b(error|exception|fail(ed|ure)?)\b/i, score: 5 },
  { regex: /\b(null pointer|nullpointerexception|cannot read prop)\b/i, score: 5 },
  { regex: /\b(unauthorized|forbidden|permission denied|access denied)\b/i, score: 4 },
  { regex: /\b(timeout|timed out|deadline exceeded|context canceled)\b/i, score: 4 },
  { regex: /\b(connection refused|econnrefused|econnreset)\b/i, score: 4 },
  { regex: /\b(crash(ed)?|restart(ing|ed)?|exit(ed)?)\b/i, score: 4 },
  { regex: /\b(circuit breaker|rate limit|throttl)\b/i, score: 3 },
  { regex: /\b(retry|retrying|backoff)\b/i, score: 3 },
  { regex: /\b(warn(ing)?)\b/i, score: 2 },
  { regex: /\b(slow|latency|degraded)\b/i, score: 2 },
];

const ISSUE_PATTERNS: Array<{ regex: RegExp; label: string }> = [
  { regex: /oom|out of memory|memory limit|oomkilled/i, label: "Out-of-memory (OOM) kill detected" },
  { regex: /disk full|no space left|enospc/i, label: "Disk space exhausted" },
  { regex: /dns|nxdomain|name resolution fail|resolv/i, label: "DNS resolution failure" },
  { regex: /certificate|ssl|tls|x509|handshake/i, label: "TLS/certificate error" },
  { regex: /circuit breaker/i, label: "Circuit breaker open — cascading failure detected" },
  { regex: /rate limit|too many requests|429/i, label: "Rate limit exceeded" },
  { regex: /connection refused|econnrefused/i, label: "Service unreachable — connection refused" },
  { regex: /timeout|timed out|deadline exceeded/i, label: "Timeout — service not responding in time" },
  { regex: /database|sql|postgres|mysql|mongo|redis/i, label: "Database connectivity or query failure" },
  { regex: /unauthorized|forbidden|permission denied|401|403/i, label: "Authentication or permission failure" },
  { regex: /null|undefined|nullpointer|cannot read/i, label: "Null/undefined reference error" },
  { regex: /panic|fatal|segfault|sigkill/i, label: "Process crash (fatal error)" },
  { regex: /restart loop|crashloopbackoff/i, label: "Container restart loop (CrashLoopBackOff)" },
  { regex: /disk|storage|volume/i, label: "Storage or disk issue" },
];

export class AnalyzerService {
  extractImportantLines(logs: string[], maxLines = 100): string[] {
    if (logs.length === 0) return [];

    const scored: ScoredLine[] = logs.map((line, index) => ({
      line,
      index,
      score: this.scoreLine(line),
    }));

    // Collect error line indices + 2-line context before + 1 line after
    const importantIndices = new Set<number>();
    for (const { index, score } of scored) {
      if (score >= 2) {
        for (let j = Math.max(0, index - 2); j <= Math.min(logs.length - 1, index + 1); j++) {
          importantIndices.add(j);
        }
      }
    }

    // Fallback: return tail if nothing found
    if (importantIndices.size === 0) {
      return logs.slice(-Math.min(maxLines, logs.length));
    }

    const selected = [...importantIndices]
      .sort((a, b) => a - b)
      .map((i) => logs[i]);

    return this.deduplicate(selected).slice(-maxLines);
  }

  detectMainIssue(lines: string[]): string {
    const joined = lines.join(" ");

    for (const { regex, label } of ISSUE_PATTERNS) {
      if (regex.test(joined)) return label;
    }

    return "Unknown issue — requires deeper analysis";
  }

  private scoreLine(line: string): number {
    return SEVERITY_RULES.reduce(
      (total, { regex, score }) => (regex.test(line) ? total + score : total),
      0
    );
  }

  private deduplicate(lines: string[]): string[] {
    const seen = new Set<string>();
    return lines.filter((line) => {
      const key = line
        .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "#UUID")
        .replace(/\d+/g, "#")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
