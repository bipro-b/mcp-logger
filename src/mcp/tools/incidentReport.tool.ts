import { ReporterService } from "../../modules/reporter/reporter.service.js";
import type { CommandResult, VerificationResult } from "../../types/index.js";
import { auditLog } from "../../modules/audit/audit.service.js";

const reporter = new ReporterService();

export const incidentReportToolDef = {
  name: "incident_report",
  description:
    "Generate a structured post-mortem after a fix. Use after verify_resolution. Returns a formatted incident report with timeline, actions taken, and verification outcome.",
  inputSchema: {
    type: "object",
    required: ["root_cause", "detected_issue", "command_results", "verification"],
    properties: {
      root_cause: {
        type: "string",
        description: "Root cause from the AI analysis in analyze_logs output",
      },
      detected_issue: {
        type: "string",
        description: "Detected issue string from analyze_logs",
      },
      command_results: {
        type: "array",
        description: "Results array returned by execute_fix",
        items: { type: "object" },
      },
      verification: {
        type: "object",
        description: "Result object from verify_resolution",
      },
      incident_id: {
        type: "string",
        description: "Optional incident ID (auto-generated if omitted)",
      },
      log_source: {
        type: "string",
        description: "Path or name of the log source",
      },
      started_at: {
        type: "string",
        description: "ISO timestamp when the incident started",
      },
    },
  },
};

interface IncidentReportArgs {
  root_cause?: string;
  detected_issue?: string;
  command_results?: CommandResult[];
  verification?: VerificationResult;
  incident_id?: string;
  log_source?: string;
  started_at?: string;
}

export async function handleIncidentReport(
  rawArgs: unknown
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
  const args = (rawArgs ?? {}) as IncidentReportArgs;

  const incident_id =
    args.incident_id ?? `INC-${Math.floor(Math.random() * 90_000 + 10_000)}`;

  const verification: VerificationResult = args.verification ?? {
    resolved: false,
    confidence: "low",
    remaining_issues: [],
    message: "Verification not performed",
  };

  const report = reporter.generate({
    incident_id,
    root_cause: args.root_cause ?? "Unknown — run analyze_logs first",
    detected_issue: args.detected_issue ?? "Unknown",
    command_results: args.command_results ?? [],
    verification,
    log_source: args.log_source,
    started_at: args.started_at,
  });

  auditLog({ tool: "incident_report", incident_id, resolved: verification.resolved, success: true });

  return { content: [{ type: "text", text: report }] };
}
