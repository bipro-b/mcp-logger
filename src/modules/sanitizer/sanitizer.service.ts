import { SANITIZATION_PATTERNS } from "./patterns";

export class SanitizerService {
  sanitizeLine(line: string): string {
    let sanitized = line;

    for (const pattern of SANITIZATION_PATTERNS) {
      sanitized = sanitized.replace(pattern.regex, pattern.replace);
    }

    return sanitized;
  }

  sanitizeLogs(logs: string[]): string[] {
    return logs.map((line) => this.sanitizeLine(line));
  }
}