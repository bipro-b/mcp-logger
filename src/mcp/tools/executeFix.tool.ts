import { ExecutorService } from "../../modules/executor/executor.service.js";
import { validateCommand } from "../../modules/executor/whitelist.js";
import { validateCommandInput } from "../../modules/validation/input.validator.js";
import { auditLog } from "../../modules/audit/audit.service.js";

const executor = new ExecutorService();

export const executeFixToolDef = {
  name: "execute_fix",
  description:
    "Execute remediation commands with security whitelisting and approval workflow. IMPORTANT: When running on the hosted Cloud Run service, this tool cannot reach your infrastructure (no kubectl/docker/systemctl access). It will automatically generate a portable bash script instead. For self-hosted deployments with local infrastructure access, commands execute directly. High-risk commands require approved: true. Use generate_script: true to always get a portable script.",
  inputSchema: {
    type: "object",
    required: ["commands"],
    properties: {
      commands: {
        type: "array",
        items: { type: "string" },
        description: "Commands to execute — from analyze_logs FIX_COMMANDS output",
      },
      dry_run: {
        type: "boolean",
        description: "Preview what would run without executing (default: true). Set false to execute.",
      },
      approved: {
        type: "boolean",
        description: "Required for high-risk commands (kubectl delete, rollback, systemctl stop). Must be true to execute commands marked risk: high.",
      },
      generate_script: {
        type: "boolean",
        description: "Return a portable bash script instead of executing — recommended for remote clusters where the server cannot access your infrastructure.",
      },
      target_type: {
        type: "string",
        enum: ["local", "kubernetes"],
        description: "Execution target (default: local)",
      },
    },
  },
};

interface ExecuteFixArgs {
  commands?: string[];
  dry_run?: boolean;
  approved?: boolean;
  generate_script?: boolean;
  target_type?: "local" | "kubernetes";
}

export async function handleExecuteFix(
  rawArgs: unknown
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
  const args = (rawArgs ?? {}) as ExecuteFixArgs;

  if (!args.commands || args.commands.length === 0) {
    return { content: [{ type: "text", text: "No commands provided." }], isError: true };
  }

  const commandError = validateCommandInput(args.commands);
  if (commandError) {
    return { content: [{ type: "text", text: `❌ ${commandError}` }], isError: true };
  }

  if (args.generate_script) {
    return generateBashScript(args.commands);
  }

  const dry_run = args.dry_run !== false;

  // On Cloud Run (K_SERVICE is set), the server has no access to customer infrastructure.
  // Auto-switch to generate_script when the user tries to actually execute commands.
  if (!dry_run && process.env.K_SERVICE) {
    const scriptResult = generateBashScript(args.commands);
    if (scriptResult.isError) return scriptResult;
    return {
      content: [{
        type: "text",
        text: [
          `⚠️ Running on hosted Cloud Run — this server cannot access your kubectl/docker/systemctl.`,
          ``,
          `A portable bash script has been generated instead. Run it on any machine`,
          `that has the required tools installed and access to your infrastructure:`,
          ``,
          scriptResult.content[0].text,
        ].join("\n"),
      }],
    };
  }

  // Approval gate for high-risk commands
  if (!dry_run) {
    const highRisk = args.commands
      .map((cmd) => ({ cmd, v: validateCommand(cmd) }))
      .filter(({ v }) => v.entry?.risk === "high");

    if (highRisk.length > 0 && !args.approved) {
      const list = highRisk
        .map(({ cmd, v }) => `  ⚠️  ${cmd}\n     ${v.entry?.description} — risk: HIGH`)
        .join("\n");

      auditLog({ tool: "execute_fix", commands: args.commands, dry_run: false, approved: false, high_risk: true });

      return {
        content: [{
          type: "text",
          text: [
            `🛑 APPROVAL REQUIRED`,
            ``,
            `The following command(s) are marked HIGH RISK and can cause service downtime:`,
            ``,
            list,
            ``,
            `Steps:`,
            `1. Review the dry-run output carefully`,
            `2. Call execute_fix again with:  dry_run: false  AND  approved: true`,
          ].join("\n"),
        }],
      };
    }
  }

  const start = Date.now();
  const results = await executor.execute(args.commands, dry_run);
  const duration = Date.now() - start;

  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  const hasHighRisk = results.some((r) => r.risk === "high");

  auditLog({
    tool: "execute_fix",
    commands: args.commands,
    dry_run,
    approved: args.approved,
    high_risk: hasHighRisk,
    success: failed === 0,
    duration_ms: duration,
  });

  const mode = dry_run
    ? "🔍 DRY RUN — No commands were actually executed"
    : "⚡ EXECUTION COMPLETE";

  const details = results
    .map((r, i) => {
      const icon = r.success ? "✅" : "❌";
      const lines = [`${i + 1}. ${icon} \`${r.command}\``];
      if (r.category) lines.push(`   Category: ${r.category} | Risk: ${r.risk}`);
      if (r.output) lines.push(`   ${r.output.replace(/\n/g, "\n   ")}`);
      if (r.error) lines.push(`   Error: ${r.error}`);
      if (!r.dry_run && r.duration_ms > 0) lines.push(`   Duration: ${r.duration_ms}ms`);
      return lines.join("\n");
    })
    .join("\n\n");

  const cloudRunNote = !dry_run
    ? ""
    : "\n\n💡 Running on Cloud Run? Use generate_script: true to get a bash script you can run locally with your own kubectl/docker access.";

  const footer = dry_run
    ? `\nRun again with dry_run: false${hasHighRisk ? " and approved: true" : ""} to execute.${cloudRunNote}`
    : "\n🔐 Commands validated against whitelist. Output sanitized.";

  return {
    content: [{ type: "text", text: `${mode}\n\n📋 ${succeeded} succeeded, ${failed} failed\n\n${details}${footer}` }],
    isError: failed > 0 && !dry_run,
  };
}

function generateBashScript(
  commands: string[]
): { content: Array<{ type: "text"; text: string }>; isError?: boolean } {
  const validations = commands.map((cmd) => ({ cmd, result: validateCommand(cmd) }));
  const blocked = validations.filter((v) => !v.result.allowed);

  if (blocked.length > 0) {
    const reasons = blocked.map((b) => `  • ${b.cmd} → ${b.result.reason}`).join("\n");
    return {
      content: [{ type: "text", text: `❌ Script blocked — ${blocked.length} command(s) failed whitelist:\n${reasons}` }],
      isError: true,
    };
  }

  const steps = validations
    .map((v, i) => {
      const entry = v.result.entry;
      return [
        `# Step ${i + 1}: ${entry?.description ?? v.cmd} (risk: ${entry?.risk ?? "unknown"})`,
        `echo "[$(date -u +%H:%M:%S)] Running: ${v.cmd}"`,
        v.cmd,
        `echo "[$(date -u +%H:%M:%S)] Done."`,
        ``,
      ].join("\n");
    })
    .join("\n");

  const script = [
    `#!/bin/bash`,
    `# ZeroTrust Log AI — Incident Remediation Script`,
    `# Generated: ${new Date().toISOString()}`,
    `# All commands validated against security whitelist`,
    ``,
    `set -e`,
    ``,
    steps,
    `echo "✅ All steps completed."`,
  ].join("\n");

  auditLog({ tool: "execute_fix", commands, dry_run: true, high_risk: validations.some(v => v.result.entry?.risk === "high") });

  return {
    content: [{
      type: "text",
      text: `📄 Bash Script (${commands.length} command${commands.length !== 1 ? "s" : ""}, all whitelisted)\nRun this on any machine with kubectl/docker/systemctl access:\n\n\`\`\`bash\n${script}\n\`\`\``,
    }],
  };
}
