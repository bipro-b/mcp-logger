import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { LogStreamer } from "./log.streamer.js";
import { validateCommand } from "../executor/whitelist.js";
import { isSsrfUrl } from "../validation/url.validator.js";

const execAsync = promisify(exec);
const streamer = new LogStreamer();
const MAX_REMOTE_BYTES = 5 * 1024 * 1024;

const TS_PATTERNS: Array<{ regex: RegExp; parse: (m: RegExpMatchArray) => number }> = [
  {
    regex: /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)/,
    parse: (m) => new Date(m[1]).getTime(),
  },
  {
    regex: /(\d{4}-\d{2}-\d{2}[ _]\d{2}:\d{2}:\d{2})/,
    parse: (m) => new Date(m[1].replace("_", " ")).getTime(),
  },
  {
    regex: /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}/,
    parse: (m) => new Date(`${m[0]} ${new Date().getFullYear()}`).getTime(),
  },
  {
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
        // try next
      }
    }
  }
  return null;
}

export interface KubectlLogInput {
  pod: string;
  namespace: string;
  container?: string;
  tail?: number;
}

export class LogService {
  async getLogs(input: {
    log_path?: string;
    log_text?: string;
    log_paths?: string[];
    log_url?: string;
    kubectl_log?: KubectlLogInput;
  }): Promise<string[]> {
    if (input.log_text) {
      return input.log_text.split("\n").filter((l) => l.trim().length > 0);
    }

    if (input.log_url) {
      return await this.fetchFromUrl(input.log_url);
    }

    if (input.kubectl_log) {
      return await this.fetchFromKubectl(input.kubectl_log);
    }

    if (input.log_paths && input.log_paths.length > 0) {
      return await this.mergeFiles(input.log_paths);
    }

    if (input.log_path) {
      return await streamer.streamFile(input.log_path);
    }

    throw new Error("No log input provided");
  }

  private async fetchFromUrl(url: string): Promise<string[]> {
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      throw new Error("log_url must start with http:// or https://");
    }
    if (isSsrfUrl(url)) {
      throw new Error("log_url points to a blocked internal address.");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`Failed to fetch logs: HTTP ${response.status} ${response.statusText}`);
      }

      const contentLength = response.headers.get("content-length");
      if (contentLength && parseInt(contentLength) > MAX_REMOTE_BYTES) {
        throw new Error(
          `Remote log is too large (${(parseInt(contentLength) / 1024 / 1024).toFixed(1)}MB). Maximum is 5MB.`
        );
      }

      const text = await response.text();
      if (Buffer.byteLength(text, "utf8") > MAX_REMOTE_BYTES) {
        throw new Error("Remote log content exceeds 5MB limit.");
      }

      return text.split("\n").filter((l) => l.trim().length > 0);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async fetchFromKubectl(input: KubectlLogInput): Promise<string[]> {
    const tail = Math.min(input.tail ?? 500, 5_000);
    const containerFlag = input.container ? ` -c ${input.container}` : "";
    const cmd = `kubectl logs ${input.pod} -n ${input.namespace} --tail=${tail}${containerFlag}`;

    const validation = validateCommand(cmd);
    if (!validation.allowed) {
      throw new Error(`kubectl logs blocked by whitelist: ${validation.reason}`);
    }

    try {
      const { stdout } = await execAsync(cmd, { timeout: 30_000 });
      return stdout.split("\n").filter((l) => l.trim().length > 0);
    } catch (err) {
      throw new Error(
        `kubectl logs failed: ${err instanceof Error ? err.message : String(err)}. Ensure kubectl is installed and configured on this machine.`
      );
    }
  }

  private async mergeFiles(paths: string[]): Promise<string[]> {
    const limited = paths.slice(0, 10);
    const perFileCap = Math.floor(50_000 / limited.length);
    const results = await Promise.all(
      limited.map(async (filePath) => {
        const label = path.basename(filePath);
        const lines = await streamer.streamFile(filePath, perFileCap);
        return lines
          .filter((l) => l.trim().length > 0)
          .map((line) => ({ label, line, ts: parseTimestamp(line) }));
      })
    );

    const all = results.flat();
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
