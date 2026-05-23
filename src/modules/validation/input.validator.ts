export const MAX_LOG_TEXT_BYTES = 5 * 1024 * 1024; // 5MB
export const MAX_LOG_FILES = 10;
export const MAX_COMMANDS = 20;
export const MAX_ENDPOINTS = 20;

export function validateLogInput(args: {
  log_text?: string;
  log_paths?: string[];
}): string | null {
  if (args.log_text) {
    const bytes = Buffer.byteLength(args.log_text, "utf8");
    if (bytes > MAX_LOG_TEXT_BYTES) {
      return `log_text is too large (${(bytes / 1024 / 1024).toFixed(1)}MB). Maximum is 5MB. Use log_path to analyze large files.`;
    }
  }
  if (args.log_paths && args.log_paths.length > MAX_LOG_FILES) {
    return `Too many files (${args.log_paths.length}). Maximum is ${MAX_LOG_FILES} files per request.`;
  }
  return null;
}

export function validateCommandInput(commands: string[]): string | null {
  if (commands.length > MAX_COMMANDS) {
    return `Too many commands (${commands.length}). Maximum is ${MAX_COMMANDS} per request.`;
  }
  return null;
}
