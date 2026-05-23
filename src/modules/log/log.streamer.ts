import * as fs from "fs";
import * as readline from "readline";

const ERROR_KEYWORDS = /error|fatal|panic|exception|fail|timeout|refused|oom|killed|crash|evict/i;

export class LogStreamer {
  async streamFile(filePath: string, maxLines = 10_000): Promise<string[]> {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(filePath)) {
        return reject(new Error(`Log file not found: ${filePath}`));
      }

      const stream = fs.createReadStream(filePath, { encoding: "utf-8" });
      const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
      const lines: string[] = [];

      rl.on("line", (line: string) => {
        lines.push(line);
        if (lines.length > maxLines) {
          lines.shift();
        }
      });

      rl.on("close", () => resolve(lines));
      rl.on("error", (err: Error) => reject(err));
    });
  }

  smartSample(lines: string[], targetSize = 2_000): string[] {
    if (lines.length <= targetSize) return lines;

    // Always keep the most recent 50%
    const recentCount = Math.floor(targetSize * 0.5);
    const recent = lines.slice(-recentCount);

    // From the older portion, pull only error/warning lines
    const earlier = lines.slice(0, lines.length - recentCount);
    const errorLines = earlier.filter((line) => ERROR_KEYWORDS.test(line));

    // Fill remaining quota from older error lines
    const errorSample = errorLines.slice(-(targetSize - recentCount));

    return [...errorSample, ...recent];
  }
}
