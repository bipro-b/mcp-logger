interface ToolMetrics {
  calls: number;
  errors: number;
  total_ms: number;
  avg_ms: number;
}

class MetricsService {
  private readonly startTime = Date.now();
  private readonly tools: Record<string, { calls: number; errors: number; total_ms: number }> = {};

  aiCalls = { total: 0, failures: 0, retries: 0, total_ms: 0 };
  rateLimitHits = 0;

  record(tool: string, durationMs: number, isError: boolean): void {
    if (!this.tools[tool]) {
      this.tools[tool] = { calls: 0, errors: 0, total_ms: 0 };
    }
    this.tools[tool].calls++;
    this.tools[tool].total_ms += durationMs;
    if (isError) this.tools[tool].errors++;
  }

  toJSON(): Record<string, unknown> {
    const toolStats: Record<string, ToolMetrics> = {};
    for (const [name, t] of Object.entries(this.tools)) {
      toolStats[name] = {
        calls: t.calls,
        errors: t.errors,
        total_ms: t.total_ms,
        avg_ms: t.calls > 0 ? Math.round(t.total_ms / t.calls) : 0,
      };
    }

    return {
      note: "counts reset on process restart — Cloud Run may spin up multiple instances",
      uptime_seconds: Math.round((Date.now() - this.startTime) / 1000),
      tools: toolStats,
      ai: this.aiCalls,
      rate_limit_hits: this.rateLimitHits,
      memory_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    };
  }
}

export const metrics = new MetricsService();
