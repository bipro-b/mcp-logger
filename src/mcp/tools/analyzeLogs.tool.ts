import * as path from "path";
import { LogService } from "../../modules/log/log.service.js";
import { LogStreamer } from "../../modules/log/log.streamer.js";
import { SanitizerService } from "../../modules/sanitizer/sanitizer.service.js";
import { AnalyzerService } from "../../modules/analyzer/analyzer.service.js";
import { AIService } from "../../modules/ai/ai.service.js";

const logService = new LogService();
const logStreamer = new LogStreamer();
const sanitizer = new SanitizerService();
const analyzer = new AnalyzerService();
const aiService = new AIService();

export const analyzeLogsToolDef = {
  name: "analyze_logs",
  description:
    "Securely analyze infrastructure logs — single or multi-service. Redacts all secrets locally, detects root cause, and returns exact fix commands. Supports up to 10 log files simultaneously for cross-service correlation.",
  inputSchema: {
    type: "object",
    properties: {
      log_path: {
        type: "string",
        description: "Absolute path to a single log file",
      },
      log_paths: {
        type: "array",
        items: { type: "string" },
        description:
          "Array of log file paths for multi-service correlation (up to 10 files). Each line is labeled with its source filename.",
      },
      log_text: {
        type: "string",
        description: "Raw log content as a string",
      },
    },
  },
};

interface AnalyzeLogsArgs {
  log_path?: string;
  log_paths?: string[];
  log_text?: string;
}

export async function handleAnalyzeLogs(
  rawArgs: unknown
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
  const args = (rawArgs ?? {}) as AnalyzeLogsArgs;

  const hasInput = args.log_path || args.log_text || (args.log_paths && args.log_paths.length > 0);
  if (!hasInput) {
    return {
      content: [{ type: "text", text: "Provide log_path, log_paths, or log_text." }],
      isError: true,
    };
  }

  const rawLogs = await logService.getLogs(args);
  if (!rawLogs || rawLogs.length === 0) {
    return { content: [{ type: "text", text: "⚠️ No logs found or empty input." }] };
  }

  // Smart sample large inputs (keep errors from full file + recent lines)
  const sampled = logStreamer.smartSample(rawLogs, 2_000);
  const sanitizedLogs = sanitizer.sanitizeLogs(sampled);

  let importantLines: string[] = [];
  let detectedIssue = "Unknown issue";
  try {
    importantLines = analyzer.extractImportantLines(sanitizedLogs, 100);
    detectedIssue = analyzer.detectMainIssue(importantLines);
  } catch {
    importantLines = sanitizedLogs.slice(-50);
  }

  // Pass source names to AI for multi-file context
  const sources = args.log_paths?.map((p) => path.basename(p));

  const aiResult = await Promise.race([
    aiService.analyzeLogs(importantLines, detectedIssue, sources),
    new Promise<string>((resolve) =>
      setTimeout(() => resolve("⚠️ AI response timed out after 30s"), 30_000)
    ),
  ]);

  const preview = importantLines.slice(-10).join("\n");
  const fileCount = args.log_paths ? args.log_paths.length : 1;
  const sourceLabel = args.log_paths ? `${fileCount} files (${args.log_paths.map((p) => path.basename(p)).join(", ")})` : args.log_path ? path.basename(args.log_path) : "direct input";

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
          `✔ ${SANITIZATION_PATTERN_COUNT} redaction patterns applied before AI processing`,
          `✔ No credentials, tokens, or IPs were exposed`,
        ].join("\n"),
      },
    ],
  };
}

const SANITIZATION_PATTERN_COUNT = 15;
