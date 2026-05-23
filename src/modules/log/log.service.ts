import * as path from "path";
import { LogStreamer } from "./log.streamer.js";

const streamer = new LogStreamer();

export class LogService {
  async getLogs(input: {
    log_path?: string;
    log_text?: string;
    log_paths?: string[];
  }): Promise<string[]> {
    if (input.log_text) {
      return input.log_text.split("\n").filter((l) => l.trim().length > 0);
    }

    if (input.log_paths && input.log_paths.length > 0) {
      return await this.mergeFiles(input.log_paths);
    }

    if (input.log_path) {
      return await streamer.streamFile(input.log_path);
    }

    throw new Error("No log input provided");
  }

  private async mergeFiles(paths: string[]): Promise<string[]> {
    const limited = paths.slice(0, 10);
    const results = await Promise.all(
      limited.map(async (filePath) => {
        const label = path.basename(filePath);
        const lines = await streamer.streamFile(filePath);
        return lines.map((line) => `[${label}] ${line}`);
      })
    );
    return results.flat();
  }
}
