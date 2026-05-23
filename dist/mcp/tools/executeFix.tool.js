"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleExecuteFix = exports.executeFixToolDef = void 0;
const executor_service_js_1 = require("../../modules/executor/executor.service.js");
const whitelist_js_1 = require("../../modules/executor/whitelist.js");
const input_validator_js_1 = require("../../modules/validation/input.validator.js");
const audit_service_js_1 = require("../../modules/audit/audit.service.js");
const executor = new executor_service_js_1.ExecutorService();
exports.executeFixToolDef = {
    name: "execute_fix",
    description: "Execute remediation commands with security whitelisting and approval workflow. All commands validated before execution. High-risk commands (kubectl delete, rollback, stop) require explicit approved: true. Use generate_script: true to get a portable bash script for remote clusters.",
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
async function handleExecuteFix(rawArgs) {
    const args = (rawArgs ?? {});
    if (!args.commands || args.commands.length === 0) {
        return { content: [{ type: "text", text: "No commands provided." }], isError: true };
    }
    const commandError = (0, input_validator_js_1.validateCommandInput)(args.commands);
    if (commandError) {
        return { content: [{ type: "text", text: `❌ ${commandError}` }], isError: true };
    }
    if (args.generate_script) {
        return generateBashScript(args.commands);
    }
    const dry_run = args.dry_run !== false;
    // Approval gate for high-risk commands
    if (!dry_run) {
        const highRisk = args.commands
            .map((cmd) => ({ cmd, v: (0, whitelist_js_1.validateCommand)(cmd) }))
            .filter(({ v }) => v.entry?.risk === "high");
        if (highRisk.length > 0 && !args.approved) {
            const list = highRisk
                .map(({ cmd, v }) => `  ⚠️  ${cmd}\n     ${v.entry?.description} — risk: HIGH`)
                .join("\n");
            (0, audit_service_js_1.auditLog)({ tool: "execute_fix", commands: args.commands, dry_run: false, approved: false, high_risk: true });
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
    (0, audit_service_js_1.auditLog)({
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
        if (r.category)
            lines.push(`   Category: ${r.category} | Risk: ${r.risk}`);
        if (r.output)
            lines.push(`   ${r.output.replace(/\n/g, "\n   ")}`);
        if (r.error)
            lines.push(`   Error: ${r.error}`);
        if (!r.dry_run && r.duration_ms > 0)
            lines.push(`   Duration: ${r.duration_ms}ms`);
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
exports.handleExecuteFix = handleExecuteFix;
function generateBashScript(commands) {
    const validations = commands.map((cmd) => ({ cmd, result: (0, whitelist_js_1.validateCommand)(cmd) }));
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
    (0, audit_service_js_1.auditLog)({ tool: "execute_fix", commands, dry_run: true, high_risk: validations.some(v => v.result.entry?.risk === "high") });
    return {
        content: [{
                type: "text",
                text: `📄 Bash Script (${commands.length} command${commands.length !== 1 ? "s" : ""}, all whitelisted)\nRun this on any machine with kubectl/docker/systemctl access:\n\n\`\`\`bash\n${script}\n\`\`\``,
            }],
    };
}
