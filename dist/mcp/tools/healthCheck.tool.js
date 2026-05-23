"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleHealthCheck = exports.healthCheckToolDef = void 0;
const audit_service_js_1 = require("../../modules/audit/audit.service.js");
const url_validator_js_1 = require("../../modules/validation/url.validator.js");
exports.healthCheckToolDef = {
    name: "health_check",
    description: "Check HTTP health of multiple service endpoints simultaneously. Returns status, HTTP code, and response time for each endpoint. Ideal for validating that services are up after a fix.",
    inputSchema: {
        type: "object",
        required: ["endpoints"],
        properties: {
            endpoints: {
                type: "array",
                description: "List of endpoints to check (max 20)",
                items: {
                    type: "object",
                    required: ["url"],
                    properties: {
                        url: {
                            type: "string",
                            description: "URL to check (must start with http:// or https://)",
                        },
                        name: {
                            type: "string",
                            description: "Human-readable name for this service",
                        },
                        expected_status: {
                            type: "number",
                            description: "Expected HTTP status code (default: 200)",
                        },
                        timeout_ms: {
                            type: "number",
                            description: "Request timeout in milliseconds (default: 5000, max: 15000)",
                        },
                    },
                },
            },
        },
    },
};
async function handleHealthCheck(rawArgs) {
    const args = (rawArgs ?? {});
    if (!args.endpoints || args.endpoints.length === 0) {
        return { content: [{ type: "text", text: "No endpoints provided." }], isError: true };
    }
    if (args.endpoints.length > 20) {
        return {
            content: [{ type: "text", text: "Maximum 20 endpoints per check." }],
            isError: true,
        };
    }
    const results = await Promise.all(args.endpoints.map(checkEndpoint));
    const up = results.filter((r) => r.status === "up").length;
    const down = results.filter((r) => r.status === "down").length;
    const degraded = results.filter((r) => r.status === "degraded").length;
    (0, audit_service_js_1.auditLog)({ tool: "health_check", endpoint_count: results.length, success: down === 0 });
    const statusLine = down > 0
        ? `🔴 ${down} service(s) DOWN — action required`
        : degraded > 0
            ? `🟡 ${degraded} service(s) DEGRADED — investigate`
            : `🟢 All ${up} service(s) healthy`;
    const rows = results.map((r) => {
        const icon = r.status === "up" ? "🟢" : r.status === "degraded" ? "🟡" : "🔴";
        const http = r.http_code ? ` [HTTP ${r.http_code}]` : "";
        const ms = `${r.response_time_ms}ms`;
        const err = r.error ? ` — ${r.error}` : "";
        return `${icon} ${r.name}${http} ${ms}${err}`;
    });
    const avgMs = results.length > 0
        ? Math.round(results.reduce((s, r) => s + r.response_time_ms, 0) / results.length)
        : 0;
    const text = [
        `🏥 Health Check — ${new Date().toISOString()}`,
        ``,
        statusLine,
        `Checked: ${results.length} endpoint(s) | Avg response: ${avgMs}ms`,
        ``,
        ...rows,
    ].join("\n");
    return { content: [{ type: "text", text }] };
}
exports.handleHealthCheck = handleHealthCheck;
async function checkEndpoint(ep) {
    const name = ep.name ?? ep.url;
    const expectedStatus = ep.expected_status ?? 200;
    const timeoutMs = Math.min(ep.timeout_ms ?? 5_000, 15_000);
    if (!ep.url.startsWith("http://") && !ep.url.startsWith("https://")) {
        return {
            endpoint: ep.url,
            name,
            status: "down",
            response_time_ms: 0,
            error: "URL must start with http:// or https://",
        };
    }
    if ((0, url_validator_js_1.isSsrfUrl)(ep.url)) {
        return {
            endpoint: ep.url,
            name,
            status: "down",
            response_time_ms: 0,
            error: "Blocked: internal/private address not accessible from Cloud Run",
        };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const start = Date.now();
    try {
        const response = await fetch(ep.url, { method: "GET", signal: controller.signal });
        const ms = Date.now() - start;
        clearTimeout(timer);
        const isOk = response.status === expectedStatus;
        const isSlow = ms > 3_000;
        return {
            endpoint: ep.url,
            name,
            status: isOk && !isSlow ? "up" : isOk ? "degraded" : "down",
            http_code: response.status,
            response_time_ms: ms,
            error: !isOk
                ? `Expected ${expectedStatus}, got ${response.status}`
                : isSlow
                    ? "Slow response (>3s)"
                    : undefined,
        };
    }
    catch (err) {
        clearTimeout(timer);
        const ms = Date.now() - start;
        const isTimeout = err instanceof Error && err.name === "AbortError";
        return {
            endpoint: ep.url,
            name,
            status: "down",
            response_time_ms: ms,
            error: isTimeout
                ? `Timed out after ${timeoutMs}ms`
                : err instanceof Error
                    ? err.message
                    : String(err),
        };
    }
}
