"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleExecuteFix = exports.executeFixToolDef = void 0;
const executor_service_js_1 = require("../../modules/executor/executor.service.js");
const executor = new executor_service_js_1.ExecutorService();
exports.executeFixToolDef = {
    name: "execute_fix",
    description: "Execute remediation commands from analyze_logs output with security whitelisting. Always preview with dry_run: true first. Commands are validated against a security whitelist — no shell injection possible.",
    inputSchema: {
        type: "object",
        required: ["commands"],
        properties: {
            commands: {
                type: "array",
                items: { type: "string" },
                description: "Commands to execute (from analyze_logs output)",
            },
            dry_run: {
                type: "boolean",
                description: "Preview mode — shows what would run without executing (default: true). Set to false to actually execute.",
            },
            target_type: {
                type: "string",
                enum: ["local", "kubernetes"],
                description: "Execution target. 'local' runs on this machine; 'kubernetes' routes kubectl commands to your configured cluster.",
            },
        },
    },
};
async function handleExecuteFix(rawArgs) {
    const args = (rawArgs ?? {});
    if (!args.commands || args.commands.length === 0) {
        return { content: [{ type: "text", text: "No commands provided." }], isError: true };
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
    const securityNote = dry_run
        ? ""
        : "\n\n🔐 Commands validated against security whitelist before execution.";
    const text = `${mode}\n\n📋 Results: ${succeeded} succeeded, ${failed} failed\n\n${details}${securityNote}`;
    return {
        content: [{ type: "text", text }],
        isError: failed > 0 && !dry_run,
    };
}
exports.handleExecuteFix = handleExecuteFix;
