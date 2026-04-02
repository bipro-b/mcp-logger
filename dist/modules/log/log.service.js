"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogService = void 0;
const log_streamer_js_1 = require("./log.streamer.js");
class LogService {
    streamer = new log_streamer_js_1.LogStreamer();
    async getLogs(input) {
        if (input.log_text) {
            return this.handleRawText(input.log_text);
        }
        if (input.log_path) {
            return await this.streamer.streamFile(input.log_path);
        }
        throw new Error("No log input provided");
    }
    handleRawText(text) {
        return text.split("\n").slice(-500); // keep last 500 lines
    }
}
exports.LogService = LogService;
