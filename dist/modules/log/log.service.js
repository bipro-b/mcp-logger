"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogService = void 0;
const path = __importStar(require("path"));
const log_streamer_js_1 = require("./log.streamer.js");
const streamer = new log_streamer_js_1.LogStreamer();
// Common timestamp patterns found in production logs
const TS_PATTERNS = [
    {
        // ISO 8601: 2024-01-15T03:14:22 or 2024-01-15T03:14:22.123Z
        regex: /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)/,
        parse: (m) => new Date(m[1]).getTime(),
    },
    {
        // Date + time: 2024-01-15 03:14:22 or 2024-01-15 03:14:22,123
        regex: /(\d{4}-\d{2}-\d{2}[ _]\d{2}:\d{2}:\d{2})/,
        parse: (m) => new Date(m[1].replace("_", " ")).getTime(),
    },
    {
        // Syslog: Jan 15 03:14:22
        regex: /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\s+(\d{2}:\d{2}:\d{2})/,
        parse: (m) => new Date(`${m[0]} ${new Date().getFullYear()}`).getTime(),
    },
    {
        // Epoch seconds (recent: 2020+)
        regex: /\b(1[6-9]\d{8})\b/,
        parse: (m) => parseInt(m[1]) * 1000,
    },
];
function parseTimestamp(line) {
    for (const { regex, parse } of TS_PATTERNS) {
        const match = line.match(regex);
        if (match) {
            try {
                const ts = parse(match);
                if (!isNaN(ts))
                    return ts;
            }
            catch {
                // try next pattern
            }
        }
    }
    return null;
}
class LogService {
    async getLogs(input) {
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
    async mergeFiles(paths) {
        const limited = paths.slice(0, 10);
        const results = await Promise.all(limited.map(async (filePath) => {
            const label = path.basename(filePath);
            const lines = await streamer.streamFile(filePath);
            return lines
                .filter((l) => l.trim().length > 0)
                .map((line) => ({ label, line, ts: parseTimestamp(line) }));
        }));
        const all = results.flat();
        // Sort by timestamp if more than half of lines have parseable timestamps
        const withTs = all.filter((x) => x.ts !== null);
        if (withTs.length > all.length * 0.5) {
            all.sort((a, b) => {
                if (a.ts === null)
                    return 1;
                if (b.ts === null)
                    return -1;
                return a.ts - b.ts;
            });
        }
        return all.map(({ label, line }) => `[${label}] ${line}`);
    }
}
exports.LogService = LogService;
