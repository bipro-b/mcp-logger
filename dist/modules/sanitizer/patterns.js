"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SANITIZATION_PATTERNS = void 0;
exports.SANITIZATION_PATTERNS = [
    // Emails
    {
        name: "EMAIL",
        regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
        replace: "[REDACTED_EMAIL]",
    },
    // IPv4 addresses (with optional port)
    {
        name: "IP_ADDRESS",
        regex: /\b(?:\d{1,3}\.){3}\d{1,3}(?::\d{1,5})?\b/g,
        replace: "[REDACTED_IP]",
    },
    // AWS Access Key IDs (always start with AKIA/ABIA/ACCA/ASIA)
    {
        name: "AWS_KEY_ID",
        regex: /\b(AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}\b/g,
        replace: "[REDACTED_AWS_KEY_ID]",
    },
    // AWS Secret Access Keys (context-sensitive)
    {
        name: "AWS_SECRET",
        regex: /(aws[_-]?secret[_-]?access[_-]?key|AWS_SECRET_ACCESS_KEY)\s*[=:]\s*["']?[A-Za-z0-9/+=]{20,}["']?/gi,
        replace: "[REDACTED_AWS_SECRET]",
    },
    // AWS ARNs
    {
        name: "AWS_ARN",
        regex: /arn:aws:[a-z0-9\-]+:[a-z0-9\-]*:\d*:[a-zA-Z0-9\-_/:.+@]+/g,
        replace: "[REDACTED_ARN]",
    },
    // Database connection strings with embedded credentials
    {
        name: "DB_URL",
        regex: /(postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|mariadb|mssql|sqlserver):\/\/[^:]+:[^@\s"',>)]+@[^\s"',>)]+/gi,
        replace: "[REDACTED_DB_URL]",
    },
    // Bearer tokens
    {
        name: "BEARER_TOKEN",
        regex: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
        replace: "Bearer [REDACTED_TOKEN]",
    },
    // JWT tokens (three base64url segments)
    {
        name: "JWT",
        regex: /\beyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\b/g,
        replace: "[REDACTED_JWT]",
    },
    // GitHub personal access tokens and fine-grained tokens
    {
        name: "GITHUB_TOKEN",
        regex: /\b(gh[psoura]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{82})\b/g,
        replace: "[REDACTED_GITHUB_TOKEN]",
    },
    // Slack webhook URLs
    {
        name: "SLACK_WEBHOOK",
        regex: /https:\/\/hooks\.slack\.com\/services\/[A-Z0-9]+\/[A-Z0-9]+\/[a-zA-Z0-9]+/g,
        replace: "[REDACTED_SLACK_WEBHOOK]",
    },
    // GCP service account emails
    {
        name: "GCP_SERVICE_ACCOUNT",
        regex: /[a-z0-9\-]+@[a-z0-9\-]+\.iam\.gserviceaccount\.com/g,
        replace: "[REDACTED_GCP_SERVICE_ACCOUNT]",
    },
    // Generic API key / secret / token assignments
    {
        name: "SECRET_ASSIGNMENT",
        regex: /\b(api[_-]?key|api[_-]?secret|access[_-]?key|access[_-]?token|secret[_-]?key|client[_-]?secret|auth[_-]?token|private[_-]?key|app[_-]?secret)\s*[=:]\s*["']?[A-Za-z0-9\-_/.+=]{8,}["']?/gi,
        replace: "[REDACTED_SECRET]",
    },
    // Password assignments
    {
        name: "PASSWORD",
        regex: /\b(password|passwd|pwd)\s*[=:]\s*["']?[^\s"',;>{]{4,}["']?/gi,
        replace: "[REDACTED_PASSWORD]",
    },
    // Private key block headers (appear split across log lines)
    {
        name: "PRIVATE_KEY_HEADER",
        regex: /-----BEGIN\s+(?:[A-Z\s]+\s+)?PRIVATE\s+KEY-----[A-Za-z0-9+/=]*/g,
        replace: "[REDACTED_PRIVATE_KEY]",
    },
    // Generic hex secrets (32+ hex chars after a key/token/secret label)
    {
        name: "HEX_SECRET",
        regex: /\b(key|token|secret|credential|hash)\s*[=:]\s*["']?[0-9a-f]{32,}["']?/gi,
        replace: "[REDACTED_SECRET]",
    },
];
