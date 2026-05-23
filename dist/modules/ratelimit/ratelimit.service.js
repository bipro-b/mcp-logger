"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimiter = void 0;
class RateLimiter {
    windows = new Map();
    maxRequests;
    windowMs;
    constructor(maxRequests = 100, windowMinutes = 60) {
        this.maxRequests = maxRequests;
        this.windowMs = windowMinutes * 60 * 1000;
        setInterval(() => this.cleanup(), 10 * 60 * 1000).unref();
    }
    check(key) {
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
    cleanup() {
        const now = Date.now();
        for (const [key, window] of this.windows) {
            if (now > window.resetAt)
                this.windows.delete(key);
        }
    }
}
exports.RateLimiter = RateLimiter;
