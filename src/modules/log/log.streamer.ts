import * as fs from "fs";
import * as zlib from "zlib";
import * as readline from "readline";
import type { Readable } from "stream";

const ERROR_KEYWORDS = /error|fatal|panic|exception|fail|timeout|refused|oom|killed|crash|evict/i;

export class LogStreamer {
  async streamFile(filePath: string, maxLines = 10_000): Promise<string[]> {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(filePath)) {
        return reject(new Error(`Log file not found: ${filePath}`));
      }

      const fileStream = fs.createReadStream(filePath);
      const isGzipped = filePath.endsWith(".gz") || filePath.endsWith(".gzip");

      let input: Readable;
      if (isGzipped) {
        const gunzip = zlib.createGunzip();
        fileStream.pipe(gunzip);
        input = gunzip;
        fileStream.on("error", reject);
        gunzip.on("error", (err) => reject(new Error(`Failed to decompress: ${err.message}`)));
      } else {
        input = fileStream;
      }

      const rl = readline.createInterface({ input, crlfDelay: Infinity });
      const lines: string[] = [];

      rl.on("line", (line: string) => {
        lines.push(line);
        if (lines.length > maxLines) lines.shift();
      });

      rl.on("close", () => resolve(lines));
      rl.on("error", (err: Error) => reject(err));
    });
  }

  smartSample(lines: string[], targetSize = 2_000): string[] {
    if (lines.length <= targetSize) return lines;

    const recentCount = Math.floor(targetSize * 0.5);
    const recent = lines.slice(-recentCount);

    const earlier = lines.slice(0, lines.length - recentCount);
    const errorLines = earlier.filter((line) => ERROR_KEYWORDS.test(line));
    const errorSample = errorLines.slice(-(targetSize - recentCount));

    return [...errorSample, ...recent];
  }
}
