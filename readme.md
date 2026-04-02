<div align="center">

```
███████╗███████╗██████╗  ██████╗ ████████╗██████╗ ██╗   ██╗███████╗████████╗
╚══███╔╝██╔════╝██╔══██╗██╔═══██╗╚══██╔══╝██╔══██╗██║   ██║██╔════╝╚══██╔══╝
  ███╔╝ █████╗  ██████╔╝██║   ██║   ██║   ██████╔╝██║   ██║███████╗   ██║   
 ███╔╝  ██╔══╝  ██╔══██╗██║   ██║   ██║   ██╔══██╗██║   ██║╚════██║   ██║   
███████╗███████╗██║  ██║╚██████╔╝   ██║   ██║  ██║╚██████╔╝███████║   ██║   
╚══════╝╚══════╝╚═╝  ╚═╝ ╚═════╝    ╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚══════╝   ╚═╝  
                                                                               
                        L O G   A I
```

**The MCP server that analyzes your infrastructure logs without ever exposing your secrets.**

[![MCP Protocol](https://img.shields.io/badge/MCP-2025--06--18-6366f1?style=flat-square)](https://modelcontextprotocol.io)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-22c55e?style=flat-square)](LICENSE)
[![Deployed on MCPize](https://img.shields.io/badge/Deployed-MCPize-f59e0b?style=flat-square)](https://mcpize.com)

</div>

---

## The Problem

Every SRE has been there. 3AM. Production is down. You have 50,000 lines of logs and no idea where to start.

You could paste them into an AI tool — but those logs contain API keys, internal IPs, JWT tokens, database credentials. You'd be feeding your infrastructure's secrets to a third-party cloud.

**ZeroTrust Log AI solves this.** It redacts all sensitive data locally, before any AI processing, then returns a precise root cause and ready-to-run fix commands. In seconds.

```
Read  →  Redact  →  Resolve
```

---

## How It Works

```
Your Logs                   ZeroTrust Engine              AI Analysis
─────────────               ─────────────────             ────────────
[ERROR] token=sk-abc...  →  [ERROR] token=[REDACTED]  →  Root Cause:
IP: 192.168.1.45         →  IP: [REDACTED_IP]         →  Redis OOM kill
Bearer eyJhbG...         →  Bearer [REDACTED_TOKEN]   →
                                                          Fix:
                             ✓ Secrets never leave        kubectl rollout restart
                               your environment           deployment/redis
```

1. **Ingest** — pass logs via file path or direct text through the MCP tool
2. **Scrub** — the Zero Trust redaction engine strips secrets, tokens, IPs, emails, and JWTs locally
3. **Analyze** — cleaned logs are processed by Gemini 2.5 Flash with SRE-optimized prompting
4. **Resolve** — receive a structured report: root cause, exact fix commands, explanation

---

## Features

| Capability | Details |
|---|---|
| 🔐 **Zero Trust Redaction** | API keys, bearer tokens, JWTs, emails, IPs scrubbed before AI sees anything |
| 🧠 **Root Cause Analysis** | Identifies the originating failure across distributed services |
| ⚡ **Large-Scale Correlation** | Processes up to 500 log lines, extracts only the signal |
| 🛠️ **SRE-Ready Output** | Returns `kubectl`, `docker`, `systemctl` commands ready to execute |
| 🔗 **MCP Native** | Plug directly into Cursor, Claude Desktop, or any MCP-compatible client |
| 🌐 **Cloud Deployed** | Hosted on Cloud Run via MCPize — no local setup required |

---

## Quick Start

### Use via MCPize (no setup)

Add to your MCP client config:

```json
{
  "mcpServers": {
    "zerotrust-log-ai": {
      "url": "https://mcp-zerotrust-log-ai-456217553981.us-central1.run.app"
    }
  }
}
```

### Self-Host

```bash
# Clone
git clone https://github.com/bipro-b/mcp-logger.git
cd mcp-logger

# Install
npm install

# Configure
cp .env.example .env
# Add your GEMINI_API_KEY to .env

# Build & run
npm run build
npm start
```

**Environment variables:**

```env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=8080
```

---

## MCP Tool Reference

### `analyze_logs`

Analyzes logs, redacts sensitive data, and returns a structured incident report.

**Input:**

```typescript
{
  log_path?: string   // absolute path to a log file
  log_text?: string   // raw log content as a string
}
```

One of `log_path` or `log_text` is required.

**Output:**

```
🚨 Issue Detected:
Timeout issue detected

📊 Analysis Summary:
- Total Lines Processed: 312
- Important Lines Found: 47

🧾 Key Log Snippets:
[REDACTED_IP] - - [ERROR] upstream timed out (110)...

Root Cause:
Redis connection pool exhausted due to missing maxmemory-policy config

Fix:
kubectl exec -it redis-pod -- redis-cli CONFIG SET maxmemory-policy allkeys-lru
kubectl rollout restart deployment/api-server

Explanation:
API servers held idle Redis connections indefinitely...

🔐 Security Guarantee:
✔ Emails, IPs, tokens, and secrets are automatically redacted
✔ No sensitive data is exposed to AI
```

---

## Redaction Patterns

The Zero Trust engine scrubs the following patterns before any data leaves your environment:

| Pattern | Example Input | Redacted Output |
|---|---|---|
| Email addresses | `user@company.com` | `[REDACTED_EMAIL]` |
| IP addresses | `192.168.1.45` | `[REDACTED_IP]` |
| API keys / secrets | `api_key=sk-abc123xyz` | `[REDACTED_SECRET]` |
| Bearer tokens | `Authorization: Bearer eyJ...` | `Bearer [REDACTED_TOKEN]` |
| JWT tokens | `eyJhbGciOiJIUzI1...` | `[REDACTED_JWT]` |

---

## Project Structure

```
src/
├── index.ts                          # Entry point
├── mcp/
│   ├── mcpServer.ts                  # HTTP server + MCP transport
│   └── tools/
│       └── analyzeLogs.tool.ts       # Tool registration + execution
└── modules/
    ├── ai/
    │   └── ai.service.ts             # Gemini API integration
    ├── analyzer/
    │   └── analyzer.service.ts       # Log pattern analysis
    ├── log/
    │   ├── log.service.ts            # Log ingestion orchestration
    │   └── log.streamer.ts           # File streaming with readline
    └── sanitizer/
        ├── patterns.ts               # Redaction regex patterns
        └── sanitizer.service.ts      # Zero Trust redaction engine
```

---

## Architecture

```
MCP Client (Cursor / Claude Desktop)
            │
            │ HTTP POST /  (MCP JSON-RPC)
            ▼
┌─────────────────────────────────────┐
│         Cloud Run Container          │
│                                     │
│  ┌──────────────────────────────┐   │
│  │   StreamableHTTPTransport    │   │
│  └──────────────┬───────────────┘   │
│                 │                   │
│  ┌──────────────▼───────────────┐   │
│  │      analyze_logs tool       │   │
│  │                              │   │
│  │  1. LogService (ingest)      │   │
│  │  2. SanitizerService (scrub) │   │  ← secrets never leave this box
│  │  3. AnalyzerService (triage) │   │
│  │  4. AIService (Gemini)       │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
            │
            │ HTTPS (redacted logs only)
            ▼
    Gemini 2.5 Flash API
```

---

## Tech Stack

- **Runtime:** Node.js 20+ / TypeScript 5.4
- **MCP SDK:** `@modelcontextprotocol/sdk` v1.28+
- **Transport:** Streamable HTTP (MCP protocol 2025-06-18)
- **AI:** Google Gemini 2.5 Flash
- **Deployment:** Google Cloud Run via MCPize
- **Module system:** ES Modules (Node16 resolution)

---

## Development

```bash
# Watch mode (recompiles on save)
npm run dev

# In a second terminal, run compiled output
npm run dev:run

# Type check
npx tsc --noEmit

# Production build
npm run build
```

---

## Roadmap

- [ ] Remote log sources (GCS, S3, CloudWatch URIs)
- [ ] `stream_logs` tool for tailing live log streams
- [ ] Per-user API key support (`credentials_mode: per_user`)
- [ ] Structured JSON output mode for pipeline integration
- [ ] Custom redaction pattern configuration
- [ ] Multi-file correlation (correlate across N log files simultaneously)

---

## Contributing

Pull requests are welcome. For major changes, open an issue first.

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/your-feature`)
3. Commit with a clear message (`git commit -m 'feat: add X'`)
4. Push and open a PR

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

<div align="center">

**Built for the 3AM incident. Tested in production.**

*ZeroTrust Log AI — because your secrets shouldn't fix your outages.*

</div>