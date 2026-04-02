"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SANITIZATION_PATTERNS = void 0;
exports.SANITIZATION_PATTERNS = [
    {
        name: "EMAIL",
        regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
        replace: "[REDACTED_EMAIL]",
    },
    {
        name: "IP_ADDRESS",
        regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
        replace: "[REDACTED_IP]",
    },
    {
        name: "API_KEY",
        regex: /\b(api[_-]?key|token|secret)[\s:=]+[A-Za-z0-9\-_]{8,}\b/gi,
        replace: "[REDACTED_SECRET]",
    },
    {
        name: "BEARER_TOKEN",
        regex: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
        replace: "Bearer [REDACTED_TOKEN]",
    },
    {
        name: "JWT",
        regex: /\beyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\b/g,
        replace: "[REDACTED_JWT]",
    },
];
