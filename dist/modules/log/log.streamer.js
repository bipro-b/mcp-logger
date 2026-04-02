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
const readline = __importStar(require("readline"));
class LogStreamer {
    async streamFile(filePath, maxLines = 500) {
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
            const lines = [];
            // Fix TS7006: Tell TS 'line' is a string
            rl.on("line", (line) => {
                lines.push(line);
                if (lines.length > maxLines) {
                    lines.shift();
                }
            });
            rl.on("close", () => {
                resolve(lines);
            });
            // Fix TS7006: Tell TS 'err' is an Error object
            rl.on("error", (err) => {
                reject(err);
            });
        });
    }
}
exports.LogStreamer = LogStreamer;
