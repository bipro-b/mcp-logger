import { exec } from "child_process";
import { promisify } from "util";
import { validateCommand } from "./whitelist.js";
import { SanitizerService } from "../sanitizer/sanitizer.service.js";
import type { CommandResult } from "../../types/index.js";

const execAsync = promisify(exec);
const EXEC_TIMEOUT_MS = 30_000;
const sanitizer = new SanitizerService();

export class ExecutorService {
  async execute(commands: string[], dry_run = true): Promise<CommandResult[]> {
    const results: CommandResult[] = [];

    for (const cmd of commands) {
      const validation = validateCommand(cmd);
      const execCmd = validation.normalized ?? cmd; // use normalized form for execution

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
        const normalizeNote =
          execCmd !== cmd ? `\nNormalized to: ${execCmd}` : "";
        results.push({
          command: cmd,
          success: true,
          output: [
            `[DRY RUN] Would execute: ${execCmd}${normalizeNote}`,
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
          execAsync(execCmd),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Command timed out after 30s")), EXEC_TIMEOUT_MS)
          ),
        ]);

        // Sanitize output — command output can contain IPs, credentials, env vars
        const rawOutput = (stdout || stderr || "(no output)").trim();
        const sanitizedOutput = sanitizer.sanitizeLogs(rawOutput.split("\n")).join("\n");

        results.push({
          command: execCmd,
          success: true,
          output: sanitizedOutput,
          duration_ms: Date.now() - start,
          dry_run: false,
          category: validation.entry?.category,
          risk: validation.entry?.risk,
          description: validation.entry?.description,
        });
      } catch (err) {
        results.push({
          command: execCmd,
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
