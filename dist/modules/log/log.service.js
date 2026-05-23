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
const child_process_1 = require("child_process");
const util_1 = require("util");
const log_streamer_js_1 = require("./log.streamer.js");
const whitelist_js_1 = require("../executor/whitelist.js");
const url_validator_js_1 = require("../validation/url.validator.js");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
const streamer = new log_streamer_js_1.LogStreamer();
const MAX_REMOTE_BYTES = 5 * 1024 * 1024;
const TS_PATTERNS = [
    {
        regex: /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)/,
        parse: (m) => new Date(m[1]).getTime(),
    },
    {
        regex: /(\d{4}-\d{2}-\d{2}[ _]\d{2}:\d{2}:\d{2})/,
        parse: (m) => new Date(m[1].replace("_", " ")).getTime(),
    },
    {
        regex: /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}/,
        parse: (m) => new Date(`${m[0]} ${new Date().getFullYear()}`).getTime(),
    },
    {
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
                // try next
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
        if (input.log_url) {
            return await this.fetchFromUrl(input.log_url);
        }
        if (input.kubectl_log) {
            return await this.fetchFromKubectl(input.kubectl_log);
        }
        if (input.log_paths && input.log_paths.length > 0) {
            return await this.mergeFiles(input.log_paths);
        }
        if (input.log_path) {
            return await streamer.streamFile(input.log_path);
        }
        throw new Error("No log input provided");
    }
    async fetchFromUrl(url) {
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            throw new Error("log_url must start with http:// or https://");
        }
        if ((0, url_validator_js_1.isSsrfUrl)(url)) {
            throw new Error("log_url points to a blocked internal address.");
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30_000);
        try {
            const response = await fetch(url, { signal: controller.signal });
            if (!response.ok) {
                throw new Error(`Failed to fetch logs: HTTP ${response.status} ${response.statusText}`);
            }
            const contentLength = response.headers.get("content-length");
            if (contentLength && parseInt(contentLength) > MAX_REMOTE_BYTES) {
                throw new Error(`Remote log is too large (${(parseInt(contentLength) / 1024 / 1024).toFixed(1)}MB). Maximum is 5MB.`);
            }
            const text = await response.text();
            if (Buffer.byteLength(text, "utf8") > MAX_REMOTE_BYTES) {
                throw new Error("Remote log content exceeds 5MB limit.");
            }
            return text.split("\n").filter((l) => l.trim().length > 0);
        }
        finally {
            clearTimeout(timeout);
        }
    }
    async fetchFromKubectl(input) {
        const tail = Math.min(input.tail ?? 500, 5_000);
        const containerFlag = input.container ? ` -c ${input.container}` : "";
        const cmd = `kubectl logs ${input.pod} -n ${input.namespace} --tail=${tail}${containerFlag}`;
        const validation = (0, whitelist_js_1.validateCommand)(cmd);
        if (!validation.allowed) {
            throw new Error(`kubectl logs blocked by whitelist: ${validation.reason}`);
        }
        try {
            const { stdout } = await execAsync(cmd, { timeout: 30_000 });
            return stdout.split("\n").filter((l) => l.trim().length > 0);
        }
        catch (err) {
            throw new Error(`kubectl logs failed: ${err instanceof Error ? err.message : String(err)}. Ensure kubectl is installed and configured on this machine.`);
        }
    }
    async mergeFiles(paths) {
        const limited = paths.slice(0, 10);
        const perFileCap = Math.floor(50_000 / limited.length);
        const results = await Promise.all(limited.map(async (filePath) => {
            const label = path.basename(filePath);
            const lines = await streamer.streamFile(filePath, perFileCap);
            return lines
                .filter((l) => l.trim().length > 0)
                .map((line) => ({ label, line, ts: parseTimestamp(line) }));
        }));
        const all = results.flat();
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
