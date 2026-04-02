"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SanitizerService = void 0;
const patterns_js_1 = require("./patterns.js");
class SanitizerService {
    sanitizeLine(line) {
        let sanitized = line;
        for (const pattern of patterns_js_1.SANITIZATION_PATTERNS) {
            sanitized = sanitized.replace(pattern.regex, pattern.replace);
        }
        return sanitized;
    }
    sanitizeLogs(logs) {
        return logs.map((line) => this.sanitizeLine(line));
    }
}
exports.SanitizerService = SanitizerService;
