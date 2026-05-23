"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateCommandInput = exports.validateLogInput = exports.MAX_ENDPOINTS = exports.MAX_COMMANDS = exports.MAX_LOG_FILES = exports.MAX_LOG_TEXT_BYTES = void 0;
exports.MAX_LOG_TEXT_BYTES = 5 * 1024 * 1024; // 5MB
exports.MAX_LOG_FILES = 10;
exports.MAX_COMMANDS = 20;
exports.MAX_ENDPOINTS = 20;
function validateLogInput(args) {
    if (args.log_text) {
        const bytes = Buffer.byteLength(args.log_text, "utf8");
        if (bytes > exports.MAX_LOG_TEXT_BYTES) {
            return `log_text is too large (${(bytes / 1024 / 1024).toFixed(1)}MB). Maximum is 5MB. Use log_path to analyze large files.`;
        }
    }
    if (args.log_paths && args.log_paths.length > exports.MAX_LOG_FILES) {
        return `Too many files (${args.log_paths.length}). Maximum is ${exports.MAX_LOG_FILES} files per request.`;
    }
    return null;
}
exports.validateLogInput = validateLogInput;
function validateCommandInput(commands) {
    if (commands.length > exports.MAX_COMMANDS) {
        return `Too many commands (${commands.length}). Maximum is ${exports.MAX_COMMANDS} per request.`;
    }
    return null;
}
exports.validateCommandInput = validateCommandInput;
