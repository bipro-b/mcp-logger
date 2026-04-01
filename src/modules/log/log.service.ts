import { LogStreamer } from "./log.streamer";

export class LogService {
  private streamer = new LogStreamer();

  async getLogs(input: {
    log_path?: string;
    log_text?: string;
  }): Promise<string[]> {
    if (input.log_text) {
      return this.handleRawText(input.log_text);
    }

    if (input.log_path) {
      return await this.streamer.streamFile(input.log_path);
    }

    throw new Error("No log input provided");
  }

  private handleRawText(text: string): string[] {
    return text.split("\n").slice(-500); // keep last 500 lines
  }
}