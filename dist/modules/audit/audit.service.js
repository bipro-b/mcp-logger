"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditLog = void 0;
function auditLog(entry) {
    const record = JSON.stringify({
        timestamp: new Date().toISOString(),
        type: "audit",
        ...entry,
    });
    process.stderr.write(`[AUDIT] ${record}\n`);
}
exports.auditLog = auditLog;
