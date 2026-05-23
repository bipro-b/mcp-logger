import { VerifierService } from "../../modules/verifier/verifier.service.js";
import { auditLog } from "../../modules/audit/audit.service.js";

const verifier = new VerifierService();

export const verifyResolutionToolDef = {
  name: "verify_resolution",
  description:
    "Re-analyze logs after executing a fix to confirm the issue is resolved. Returns confidence score and remaining issues.",
  inputSchema: {
    type: "object",
    required: ["original_issue"],
    properties: {
      original_issue: {
        type: "string",
        description: "The detected_issue string returned by analyze_logs",
      },
      log_path: {
        type: "string",
        description: "Same log file path used in analyze_logs",
      },
      log_text: {
        type: "string",
        description: "Updated log text to verify against",
      },
    },
  },
};

interface VerifyResolutionArgs {
  original_issue?: string;
  log_path?: string;
  log_text?: string;
}

export async function handleVerifyResolution(
  rawArgs: unknown
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
  const args = (rawArgs ?? {}) as VerifyResolutionArgs;

  if (!args.original_issue) {
    return {
      content: [{ type: "text", text: "original_issue is required." }],
      isError: true,
    };
  }

  if (!args.log_path && !args.log_text) {
    return {
      content: [{ type: "text", text: "Provide log_path or log_text to verify against." }],
      isError: true,
    };
  }

  const result = await verifier.verify(args.original_issue, {
    log_path: args.log_path,
    log_text: args.log_text,
  });

  auditLog({ tool: "verify_resolution", resolved: result.resolved, success: true });

  const statusIcon = result.resolved ? "✅" : "⚠️";
  const confidenceBar = {
    high: "████████ HIGH",
    medium: "█████    MEDIUM",
    low: "██       LOW",
  }[result.confidence];

  const remaining =
    result.remaining_issues.length > 0
      ? `\n\nRemaining issues:\n${result.remaining_issues.map((i) => `• ${i}`).join("\n")}`
      : "";

  const text = [
    `${statusIcon} Verification: ${result.resolved ? "RESOLVED" : "UNRESOLVED"}`,
    `Confidence: ${confidenceBar}`,
    ``,
    result.message,
    remaining,
  ].join("\n");

  return { content: [{ type: "text", text }] };
}
