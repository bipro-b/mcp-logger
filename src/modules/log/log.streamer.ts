import * as fs from "fs";
import * as readline from "readline";

export class LogStreamer {
  async streamFile(filePath: string, maxLines = 500): Promise<string[]> {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(filePath)) {
        return reject(new Error("Log file not found"));
      }

      const stream = fs.createReadStream(filePath, {
        encoding: "utf-8",
      });

      const rl = readline.createInterface({
        input: stream,
        crlfDelay: Infinity,
      });

      const lines: string[] = [];

      // Fix TS7006: Tell TS 'line' is a string
      rl.on("line", (line: string) => {
        lines.push(line);

        if (lines.length > maxLines) {
          lines.shift();
        }
      });

      rl.on("close", () => {
        resolve(lines);
      });

      // Fix TS7006: Tell TS 'err' is an Error object
      rl.on("error", (err: Error) => {
        reject(err);
      });
    });
  }
}