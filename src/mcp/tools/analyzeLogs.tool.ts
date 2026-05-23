import * as path from "path";
import { LogService } from "../../modules/log/log.service.js";
import { LogStreamer } from "../../modules/log/log.streamer.js";
import { formatLogLines } from "../../modules/log/log.formatter.js";
import { SanitizerService } from "../../modules/sanitizer/sanitizer.service.js";
import { AnalyzerService } from "../../modules/analyzer/analyzer.service.js";
import { AIService } from "../../modules/ai/ai.service.js";
import { validateLogInput } from "../../modules/validation/input.validator.js";

const logService = new LogService();
const logStreamer = new LogStreamer();
const sanitizer = new SanitizerService();
const analyzer = new AnalyzerService();
const aiService = new AIService();

export const analyzeLogsToolDef = {
  name: "analyze_logs",
  description:
    "Securely analyze infrastructure logs. Redacts all secrets locally before any AI processing. Supports plain text, JSON structured logs, .gz compressed files, HTTP/HTTPS URLs (presigned S3/GCS), and up to 10 simultaneous log files for cross-service correlation.",
  inputSchema: {
    type: "object",
    properties: {
      log_path: {
        type: "string",
        description: "Absolute path to a log file (.log or .gz)",
      },
      log_paths: {
        type: "array",
        items: { type: "string" },
        description: "Multiple log file paths for cross-service correlation (up to 10). Lines are labeled with filename and sorted by timestamp.",
      },
      log_text: {
        type: "string",
        description: "Raw log content as a string (max 5MB)",
      },
      log_url: {
        type: "string",
        description: "HTTP/HTTPS URL to fetch logs from — supports presigned S3 URLs, GCS signed URLs, or any endpoint returning plain text logs (max 5MB)",
      },
      kubectl_log: {
        type: "object",
        description: "Fetch logs directly from a Kubernetes pod (requires kubectl configured on this machine — self-hosted mode only)",
        properties: {
          pod: { type: "string", description: "Pod name" },
          namespace: { type: "string", description: "Kubernetes namespace" },
          container: { type: "string", description: "Container name (optional)" },
          tail: { type: "number", description: "Number of lines to fetch (default 500, max 5000)" },
        },
        required: ["pod", "namespace"],
      },
    },
  },
};

interface AnalyzeLogsArgs {
  log_path?: string;
  log_paths?: string[];
  log_text?: string;
  log_url?: string;
  kubectl_log?: { pod: string; namespace: string; container?: string; tail?: number };
}

export async function handleAnalyzeLogs(
  rawArgs: unknown
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
  const args = (rawArgs ?? {}) as AnalyzeLogsArgs;

  const hasInput =
    args.log_path ||
    args.log_text ||
    args.log_url ||
    args.kubectl_log ||
    (args.log_paths && args.log_paths.length > 0);

  if (!hasInput) {
    return {
      content: [{ type: "text", text: "Provide one of: log_path, log_paths, log_text, log_url, or kubectl_log." }],
      isError: true,
    };
  }

  const validationError = validateLogInput({
    log_text: args.log_text,
    log_paths: args.log_paths,
  });
  if (validationError) {
    return { content: [{ type: "text", text: `❌ ${validationError}` }], isError: true };
  }

  const rawLogs = await logService.getLogs(args);
  if (!rawLogs || rawLogs.length === 0) {
    return { content: [{ type: "text", text: "⚠️ No logs found or empty input." }] };
  }

  // Pipeline: smart sample → parse JSON lines → redact secrets → analyze
  const sampled = logStreamer.smartSample(rawLogs, 2_000);
  const formatted = formatLogLines(sampled);
  const sanitizedLogs = sanitizer.sanitizeLogs(formatted);

  let importantLines: string[] = [];
  let detectedIssue = "Unknown issue";
  try {
    importantLines = analyzer.extractImportantLines(sanitizedLogs, 100);
    detectedIssue = analyzer.detectMainIssue(importantLines);
  } catch {
    importantLines = sanitizedLogs.slice(-50);
  }

  const sources = args.log_paths?.map((p) => path.basename(p));

  const aiResult = await Promise.race([
    aiService.analyzeLogs(importantLines, detectedIssue, sources),
    new Promise<string>((resolve) =>
      setTimeout(() => resolve("⚠️ AI response timed out after 30s"), 30_000)
    ),
  ]);

  const preview = importantLines.slice(-10).join("\n");

  let sourceLabel = "direct input";
  if (args.log_paths) sourceLabel = `${args.log_paths.length} files — ${args.log_paths.map((p) => path.basename(p)).join(", ")}`;
  else if (args.log_path) sourceLabel = path.basename(args.log_path);
  else if (args.log_url) sourceLabel = `remote URL`;
  else if (args.kubectl_log) sourceLabel = `kubectl: ${args.kubectl_log.pod} (${args.kubectl_log.namespace})`;

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
          `✔ 16 redaction patterns applied (AWS keys, DB URLs, tokens, passwords, IPs, IPv6, and more)`,
          `✔ No credentials were sent to AI`,
        ].join("\n"),
      },
    ],
  };
}
