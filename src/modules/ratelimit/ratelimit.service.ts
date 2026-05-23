interface Window {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter?: number;
}

export class RateLimiter {
  private readonly windows = new Map<string, Window>();
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests = 100, windowMinutes = 60) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMinutes * 60 * 1000;
    setInterval(() => this.cleanup(), 10 * 60 * 1000).unref();
  }

  check(key: string): RateLimitResult {
    const now = Date.now();
    const existing = this.windows.get(key);

    if (!existing || now > existing.resetAt) {
      this.windows.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, remaining: this.maxRequests - 1 };
    }

    if (existing.count >= this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        retryAfter: Math.ceil((existing.resetAt - now) / 1000),
      };
    }

    existing.count++;
    return { allowed: true, remaining: this.maxRequests - existing.count };
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, window] of this.windows) {
      if (now > window.resetAt) this.windows.delete(key);
    }
  }
}
