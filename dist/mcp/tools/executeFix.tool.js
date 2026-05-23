"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleExecuteFix = exports.executeFixToolDef = void 0;
const executor_service_js_1 = require("../../modules/executor/executor.service.js");
const whitelist_js_1 = require("../../modules/executor/whitelist.js");
const input_validator_js_1 = require("../../modules/validation/input.validator.js");
const executor = new executor_service_js_1.ExecutorService();
exports.executeFixToolDef = {
    name: "execute_fix",
    description: "Execute remediation commands from analyze_logs output. Commands are validated against a security whitelist — no shell injection possible. Use dry_run: true (default) to preview first. Use generate_script: true to get a portable bash script you can run on any machine with cluster access.",
    inputSchema: {
        type: "object",
        required: ["commands"],
        properties: {
            commands: {
                type: "array",
                items: { type: "string" },
                description: "Commands to execute (from analyze_logs FIX_COMMANDS output)",
            },
            dry_run: {
                type: "boolean",
                description: "Preview what would run without executing (default: true). Set false to execute for real.",
            },
            generate_script: {
                type: "boolean",
                description: "Return a bash script you can copy and run on any machine — useful when the server cannot reach your cluster directly.",
            },
            target_type: {
                type: "string",
                enum: ["local", "kubernetes"],
                description: "Execution target (default: local). kubernetes routes kubectl commands to your configured cluster.",
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
    // generate_script mode — validate and return portable bash script
    if (args.generate_script) {
        return generateBashScript(args.commands);
    }
    const dry_run = args.dry_run !== false;
    const results = await executor.execute(args.commands, dry_run);
    const mode = dry_run
        ? "🔍 DRY RUN — No commands were actually executed"
        : "⚡ EXECUTION COMPLETE";
    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;
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
    const footer = dry_run
        ? "\n\nRun again with dry_run: false to execute, or generate_script: true to get a portable script."
        : "\n\n🔐 All commands validated against security whitelist before execution.";
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
            content: [{ type: "text", text: `❌ Script generation blocked — ${blocked.length} command(s) failed whitelist validation:\n${reasons}` }],
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
        `# Commands: ${commands.length} | All validated against security whitelist`,
        `#`,
        `# Run on any machine with appropriate cluster/service access.`,
        ``,
        `set -e  # stop on first error`,
        ``,
        steps,
        `echo "✅ All steps completed."`,
    ].join("\n");
    return {
        content: [
            {
                type: "text",
                text: `📄 Bash Script (${commands.length} command${commands.length > 1 ? "s" : ""}, all whitelisted):\n\n\`\`\`bash\n${script}\n\`\`\``,
            },
        ],
    };
}
