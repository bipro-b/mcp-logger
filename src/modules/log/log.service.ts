import * as path from "path";
import { LogStreamer } from "./log.streamer.js";

const streamer = new LogStreamer();

// Common timestamp patterns found in production logs
const TS_PATTERNS: Array<{ regex: RegExp; parse: (m: RegExpMatchArray) => number }> = [
  {
    // ISO 8601: 2024-01-15T03:14:22 or 2024-01-15T03:14:22.123Z
    regex: /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)/,
    parse: (m) => new Date(m[1]).getTime(),
  },
  {
    // Date + time: 2024-01-15 03:14:22 or 2024-01-15 03:14:22,123
    regex: /(\d{4}-\d{2}-\d{2}[ _]\d{2}:\d{2}:\d{2})/,
    parse: (m) => new Date(m[1].replace("_", " ")).getTime(),
  },
  {
    // Syslog: Jan 15 03:14:22
    regex: /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s+(\d{2}:\d{2}:\d{2})/,
    parse: (m) => new Date(`${m[0]} ${new Date().getFullYear()}`).getTime(),
  },
  {
    // Epoch seconds (recent: 2020+)
    regex: /\b(1[6-9]\d{8})\b/,
    parse: (m) => parseInt(m[1]) * 1000,
  },
];

function parseTimestamp(line: string): number | null {
  for (const { regex, parse } of TS_PATTERNS) {
    const match = line.match(regex);
    if (match) {
      try {
        const ts = parse(match);
        if (!isNaN(ts)) return ts;
      } catch {
        // try next pattern
      }
    }
  }
  return null;
}

export class LogService {
  async getLogs(input: {
    log_path?: string;
    log_text?: string;
    log_paths?: string[];
  }): Promise<string[]> {
    if (input.log_text) {
      return input.log_text.split("\n").filter((l) => l.trim().length > 0);
    }

    if (input.log_paths && input.log_paths.length > 0) {
      return await this.mergeFiles(input.log_paths);
    }

    if (input.log_path) {
      return await streamer.streamFile(input.log_path);
    }

    throw new Error("No log input provided");
  }

  private async mergeFiles(paths: string[]): Promise<string[]> {
    const limited = paths.slice(0, 10);
    const results = await Promise.all(
      limited.map(async (filePath) => {
        const label = path.basename(filePath);
        const lines = await streamer.streamFile(filePath);
        return lines
          .filter((l) => l.trim().length > 0)
          .map((line) => ({ label, line, ts: parseTimestamp(line) }));
      })
    );

    const all = results.flat();

    // Sort by timestamp if more than half of lines have parseable timestamps
    const withTs = all.filter((x) => x.ts !== null);
    if (withTs.length > all.length * 0.5) {
      all.sort((a, b) => {
        if (a.ts === null) return 1;
        if (b.ts === null) return -1;
        return a.ts - b.ts;
      });
    }

    return all.map(({ label, line }) => `[${label}] ${line}`);
  }
}
