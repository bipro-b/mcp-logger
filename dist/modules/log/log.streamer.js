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
exports.LogStreamer = void 0;
const fs = __importStar(require("fs"));
const zlib = __importStar(require("zlib"));
const readline = __importStar(require("readline"));
const ERROR_KEYWORDS = /error|fatal|panic|exception|fail|timeout|refused|oom|killed|crash|evict/i;
const STACK_CONTINUATION = /^(\t|\s{4,}|Caused by:|\.\.\..*\d+ more)/;
class LogStreamer {
    async streamFile(filePath, maxLines = 10_000) {
        return new Promise((resolve, reject) => {
            if (!fs.existsSync(filePath)) {
                return reject(new Error(`Log file not found: ${filePath}`));
            }
            const fileStream = fs.createReadStream(filePath);
            const isGzipped = filePath.endsWith(".gz") || filePath.endsWith(".gzip");
            let input;
            if (isGzipped) {
                const gunzip = zlib.createGunzip();
                fileStream.pipe(gunzip);
                input = gunzip;
                fileStream.on("error", reject);
                gunzip.on("error", (err) => reject(new Error(`Failed to decompress: ${err.message}`)));
            }
            else {
                input = fileStream;
            }
            const rl = readline.createInterface({ input, crlfDelay: Infinity });
            const lines = [];
            rl.on("line", (line) => {
                lines.push(line);
                if (lines.length > maxLines)
                    lines.shift();
            });
            rl.on("close", () => resolve(lines));
            rl.on("error", (err) => reject(err));
        });
    }
    foldStackTraces(lines) {
        const result = [];
        for (const line of lines) {
            if (result.length > 0 && STACK_CONTINUATION.test(line)) {
                result[result.length - 1] += "\n" + line;
            }
            else {
                result.push(line);
            }
        }
        return result;
    }
    smartSample(lines, targetSize = 2_000) {
        if (lines.length <= targetSize)
            return lines;
        const recentCount = Math.floor(targetSize * 0.5);
        const recent = lines.slice(-recentCount);
        const earlier = lines.slice(0, lines.length - recentCount);
        const errorLines = earlier.filter((line) => ERROR_KEYWORDS.test(line));
        const errorSample = errorLines.slice(-(targetSize - recentCount));
        return [...errorSample, ...recent];
    }
}
exports.LogStreamer = LogStreamer;
