"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatLogLines = void 0;
const LEVEL_FIELDS = ["level", "severity", "lvl", "log_level", "loglevel"];
const MESSAGE_FIELDS = ["message", "msg", "error", "err", "text", "body"];
const SERVICE_FIELDS = ["service", "app", "component", "logger", "name", "source"];
const TIMESTAMP_FIELDS = ["timestamp", "time", "ts", "@timestamp", "datetime", "date"];
function formatLogLines(lines) {
    return lines.map(formatLine);
}
exports.formatLogLines = formatLogLines;
function formatLine(line) {
    // Handle [filename] prefix from multi-file logs
    let prefix = "";
    let content = line;
    const prefixMatch = line.match(/^(\[[^\]]+\])\s+(.*)$/);
    if (prefixMatch) {
        prefix = prefixMatch[1] + " ";
        content = prefixMatch[2];
    }
    const trimmed = content.trim();
    if (!trimmed.startsWith("{"))
        return line;
    try {
        const obj = JSON.parse(trimmed);
        return prefix + formatJsonLog(obj);
    }
    catch {
        return line;
    }
}
function formatJsonLog(obj) {
    const parts = [];
    const ts = extractField(obj, TIMESTAMP_FIELDS);
    if (ts)
        parts.push(String(ts).slice(0, 23));
    const level = extractField(obj, LEVEL_FIELDS);
    if (level)
        parts.push(String(level).toUpperCase().padEnd(5).slice(0, 5));
    const service = extractField(obj, SERVICE_FIELDS);
    if (service)
        parts.push(`[${service}]`);
    const msg = extractField(obj, MESSAGE_FIELDS);
    if (msg)
        parts.push(String(msg));
    // Include stack trace first line if present
    if (obj["stack"] && typeof obj["stack"] === "string") {
        const firstLine = obj["stack"].split("\n")[0];
        if (firstLine && firstLine !== msg)
            parts.push(`| stack: ${firstLine}`);
    }
    // Include extra error field if different from msg
    const errField = obj["error"] ?? obj["err"];
    if (errField && typeof errField === "object" && errField !== null) {
        const nested = errField;
        const nestedMsg = extractField(nested, MESSAGE_FIELDS);
        if (nestedMsg)
            parts.push(`| error: ${nestedMsg}`);
    }
    // Include http status if present
    const status = obj["status"] ?? obj["statusCode"] ?? obj["http_status"];
    if (status !== undefined)
        parts.push(`| status=${status}`);
    return parts.length > 0 ? parts.join(" ") : JSON.stringify(obj);
}
function extractField(obj, fields) {
    for (const field of fields) {
        if (obj[field] !== undefined && obj[field] !== null)
            return obj[field];
    }
    return undefined;
}
