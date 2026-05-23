"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecutorService = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const whitelist_js_1 = require("./whitelist.js");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
const EXEC_TIMEOUT_MS = 30_000;
class ExecutorService {
    async execute(commands, dry_run = true) {
        const results = [];
        for (const cmd of commands) {
            const validation = (0, whitelist_js_1.validateCommand)(cmd);
            if (!validation.allowed) {
                results.push({
                    command: cmd,
                    success: false,
                    output: "",
                    error: validation.reason,
                    duration_ms: 0,
                    dry_run,
                });
                break;
            }
            if (dry_run) {
                results.push({
                    command: cmd,
                    success: true,
                    output: [
                        `[DRY RUN] Would execute: ${cmd}`,
                        `Category: ${validation.entry?.category}`,
                        `Risk: ${validation.entry?.risk}`,
                        `Description: ${validation.entry?.description}`,
                    ].join("\n"),
                    duration_ms: 0,
                    dry_run: true,
                    category: validation.entry?.category,
                    risk: validation.entry?.risk,
                    description: validation.entry?.description,
                });
                continue;
            }
            const start = Date.now();
            try {
                const { stdout, stderr } = await Promise.race([
                    execAsync(cmd),
                    new Promise((_, reject) => setTimeout(() => reject(new Error("Command timed out after 30s")), EXEC_TIMEOUT_MS)),
                ]);
                results.push({
                    command: cmd,
                    success: true,
                    output: (stdout || stderr || "(no output)").trim(),
                    duration_ms: Date.now() - start,
                    dry_run: false,
                    category: validation.entry?.category,
                    risk: validation.entry?.risk,
                    description: validation.entry?.description,
                });
            }
            catch (err) {
                results.push({
                    command: cmd,
                    success: false,
                    output: "",
                    error: err instanceof Error ? err.message : String(err),
                    duration_ms: Date.now() - start,
                    dry_run: false,
                });
                break;
            }
        }
        return results;
    }
}
exports.ExecutorService = ExecutorService;
