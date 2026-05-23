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
            return lines.map((line) => `[${label}] ${line}`);
        }));
        return results.flat();
    }
}
exports.LogService = LogService;
