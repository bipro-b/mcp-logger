"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditLog = void 0;
const request_context_js_1 = require("./request-context.js");
function auditLog(entry) {
    const ctx = request_context_js_1.requestContext.getStore();
    const record = JSON.stringify({
        timestamp: new Date().toISOString(),
        type: "audit",
        request_id: ctx?.requestId,
        ...entry,
    });
    process.stderr.write(`[AUDIT] ${record}\n`);
}
exports.auditLog = auditLog;
