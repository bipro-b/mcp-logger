"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metrics = void 0;
class MetricsService {
    startTime = Date.now();
    tools = {};
    aiCalls = { total: 0, failures: 0, retries: 0, total_ms: 0 };
    rateLimitHits = 0;
    record(tool, durationMs, isError) {
        if (!this.tools[tool]) {
            this.tools[tool] = { calls: 0, errors: 0, total_ms: 0 };
        }
        this.tools[tool].calls++;
        this.tools[tool].total_ms += durationMs;
        if (isError)
            this.tools[tool].errors++;
    }
    toJSON() {
        const toolStats = {};
        for (const [name, t] of Object.entries(this.tools)) {
            toolStats[name] = {
                calls: t.calls,
                errors: t.errors,
                total_ms: t.total_ms,
                avg_ms: t.calls > 0 ? Math.round(t.total_ms / t.calls) : 0,
            };
        }
        return {
            uptime_seconds: Math.round((Date.now() - this.startTime) / 1000),
            tools: toolStats,
            ai: this.aiCalls,
            rate_limit_hits: this.rateLimitHits,
            memory_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        };
    }
}
exports.metrics = new MetricsService();
