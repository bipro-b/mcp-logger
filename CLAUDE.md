# ZeroTrust Log AI — Claude Code Context

## Project Identity

- **Name:** ZeroTrust Log AI
- **Version:** 2.0.0
- **Mission:** Analyze infrastructure logs, redact secrets locally, execute fixes autonomously — no DevOps expert required
- **Stack:** TypeScript 5.4 · Node.js 20+ · MCP SDK 1.28+ · Gemini 2.5 Flash · Google Cloud Run
- **Protocol:** MCP 2025-06-18 · Streamable HTTP transport
- **Deployed at:** https://mcp-zerotrust-log-ai-456217553981.us-central1.run.app
- **Repo:** https://github.com/bipro-b/mcp-logger

---

## Architecture — Read This First

```
src/
├── index.ts                              ← entry point (MCPize expects dist/index.js)
├── mcp/
│   ├── mcpServer.ts                      ← HTTP server on PORT=8080, registers all tools
│   └── tools/
│       ├── analyzeLogs.tool.ts           ← v1: find root cause, suggest fix
│       ├── executeFix.tool.ts            ← v2: execute commands (whitelist + dry-run + approval)
│       ├── verifyResolution.tool.ts      ← v2: confirm fix worked
│       └── incidentReport.tool.ts        ← v2: generate post-mortem
└── modules/
    ├── ai/ai.service.ts                  ← Gemini 2.5 Flash integration
    ├── analyzer/analyzer.service.ts      ← log pattern triage
    ├── executor/
    │   ├── whitelist.ts                  ← SECURITY CORE — command allowlist
    │   └── executor.service.ts           ← local / SSH / kubernetes execution
    ├── log/
    │   ├── log.service.ts                ← log ingestion orchestration
    │   └── log.streamer.ts               ← file streaming
    ├── sanitizer/
    │   ├── patterns.ts                   ← redaction regex patterns
    │   └── sanitizer.service.ts          ← Zero Trust redaction engine
    ├── verifier/verifier.service.ts      ← post-fix verification
    └── reporter/reporter.service.ts      ← incident report generator
```

### Critical architectural rules

- **Entry point is `src/index.ts` → compiles to `dist/index.js`** — MCPize is hardcoded to run `/app/dist/index.js`. Never rename this file.
- **HTTP transport only** — server listens on `PORT=8080`. Never switch back to `StdioServerTransport` for production.
- **stdout must be pure JSON-RPC** — all logging goes to `process.stderr.write()`. Never use `console.log`. Never use `console.error`. Both go to stdout in some environments.
- **Module resolution is Node16** — every relative import requires `.js` extension even though source files are `.ts`. Example: `import { Foo } from "./foo.js"` not `"./foo"`.
- **No `node-fetch`** — Node 20 has native `fetch`. Do not re-add this dependency.

---

## Essential Commands

```bash
# Development (two terminals)
npm run dev          # Terminal 1: tsc --watch (recompiles on save)
npm run dev:run      # Terminal 2: node dist/index.js

# Production build
npm run build        # runs tsc, outputs to dist/

# Verify stdout is clean (PowerShell — must be blank)
node dist/index.js 2>$null

# Test HTTP server locally
curl http://localhost:8080/ping          # → pong
curl -X POST http://localhost:8080/      # → JSON-RPC response

# Type check only (no emit)
npx tsc --noEmit

# Deploy (auto-triggers on push)
git add .
git commit -m "feat: description"
git push
```

---

## Tool Reference — v2

### Workflow (always in this order)

```
analyze_logs → execute_fix (dry_run: true) → execute_fix (dry_run: false) → verify_resolution → incident_report
```

### `analyze_logs`
Ingests logs, redacts secrets locally, returns root cause + suggested commands.

```typescript
// Input
{ log_path?: string, log_text?: string }
// One of the two is required
```

### `execute_fix`
Executes remediation commands. **Default is dry_run: true** — always preview first.

```typescript
{
  commands: string[],         // from analyze_logs output
  dry_run?: boolean,          // DEFAULT TRUE — must explicitly set false to execute
  target_type?: "local" | "ssh" | "kubernetes",
  ssh_host?: string,          // required if target_type === "ssh"
  ssh_user?: string,
  ssh_key_path?: string,
  ssh_port?: number,
  kube_namespace?: string,
}
```

Security layers (in order):
1. Shell injection check — rejects any command with `;`, `&`, `|`, `` ` ``, `$`, `(`, `)`, `{`, `}`, `[`, `]`, `<`, `>`, `\`
2. Whitelist validation — must match a pattern in `src/modules/executor/whitelist.ts`
3. Dry-run preview — shows category, risk level, description before executing
4. Execution with 30s timeout — stops chain on first failure

### `verify_resolution`
Re-reads logs after a fix, returns confidence score.

```typescript
{
  original_issue: string,     // from analyze_logs detected_issue field
  log_path?: string,          // same log source
  log_text?: string,
}
// Returns: resolved: boolean, confidence: "high"|"medium"|"low"
```

### `incident_report`
Generates structured post-mortem with timeline, execution log, verification result.

```typescript
{
  root_cause: string,         // from analyze_logs
  detected_issue: string,     // from analyze_logs
  command_results: CommandResult[],   // from execute_fix
  verification: VerificationResult,  // from verify_resolution
  incident_id?: string,       // auto-generated if omitted (INC-XXXXX)
  log_source?: string,
  started_at?: string,        // ISO timestamp
}
```

---

## Security Model — Never Bypass This

The whitelist in `src/modules/executor/whitelist.ts` is the security core. When adding new commands:

1. Write the most restrictive regex possible
2. Assign the correct risk level (`low` / `medium` / `high`)
3. Add a human-readable description
4. Test: `pattern.test("your command")` must return `true`
5. Test: `pattern.test("your command && rm -rf /")` must return `false`

**Never do these:**
- Never use `exec(userInput)` directly
- Never interpolate unsanitized strings into commands
- Never add a wildcard `.*` pattern to the whitelist
- Never remove the shell operator check

Current whitelist covers: `kubectl` (9 patterns) · `docker` (6 patterns) · `systemctl` (5 patterns) · `pm2` (5 patterns) · `disk/network diagnostics` (4 patterns)

---

## Environment Variables

```env
GEMINI_API_KEY=          # required for AI analysis — lazy checked (server stays up without it)
PORT=8080                # Cloud Run sets this automatically
NODE_ENV=production      # set in deployment
```

The `GEMINI_API_KEY` check is intentionally lazy — the server starts and registers all tools even without it. The AI fallback activates if the key is missing. This prevents the entire server from crashing at startup when the key isn't set yet.

---

## Code Standards

### TypeScript rules
- `strict: true` — no exceptions
- No `any` — use `unknown` then narrow with type guards
- All relative imports need `.js` extension — `import { X } from "./foo.js"`
- No default exports — named exports only
- All async functions need explicit return types
- Errors: always `err instanceof Error ? err.message : String(err)` — never assume error type

### Logging rules
```typescript
// ✅ correct
process.stderr.write(`Message: ${value}\n`);

// ❌ never
console.log("anything");
console.error("anything");
```

### Module registration pattern
Each tool file exports one `register*Tool(server: Server)` function.
`mcpServer.ts` calls them all in order — never register tools elsewhere.

---

## Adding a New Whitelisted Command

```typescript
// In src/modules/executor/whitelist.ts
{
  pattern: /^kubectl get events -n [\w\-]+$/,
  category: "kubernetes",
  description: "List events in a namespace",
  risk: "low",
},
```

Then rebuild and test:
```bash
npm run build
node -e "
const { validateCommand } = require('./dist/modules/executor/whitelist.js');
console.log(validateCommand('kubectl get events -n production'));
console.log(validateCommand('kubectl get events -n production && rm -rf /'));
"
```

First call must return `{ allowed: true, entry: {...} }`.
Second call must return `{ allowed: false, reason: '...' }`.

---

## Adding a New Tool

1. Create `src/mcp/tools/yourTool.tool.ts`
2. Export `registerYourTool(server: Server)`
3. Use `ListToolsRequestSchema` handler — spread previous tools:
   ```typescript
   server.setRequestHandler(ListToolsRequestSchema, async (_, previous) => {
     const prev = await previous?.();
     return { tools: [...(prev?.tools ?? []), { name: "your_tool", ... }] };
   });
   ```
4. Use `CallToolRequestSchema` handler — pass unknown tools to `previous`:
   ```typescript
   if (request.params.name !== "your_tool") {
     return previous?.(request) ?? { content: [{ type: "text", text: "Unknown tool" }], isError: true };
   }
   ```
5. Import and call `registerYourTool(server)` in `src/mcp/mcpServer.ts`
6. Run `npm run build` — check zero errors
7. Test locally before pushing

---

## Deployment Checklist

Before every push:
- [ ] `npm run build` — zero TypeScript errors
- [ ] `node dist/index.js 2>$null` in PowerShell — completely blank stdout
- [ ] `curl http://localhost:8080/ping` — returns `pong`
- [ ] All new relative imports have `.js` extension
- [ ] No `console.log` or `console.error` anywhere in src/
- [ ] `GEMINI_API_KEY` set in MCPize Secrets tab
- [ ] `dist/` is committed to git (not in .gitignore)

After push:
- MCPize auto-deploys on every push to `main`
- Check MCPize dashboard → Deploys tab → wait for green
- Check Capabilities tab → Tools should list all 4 tools
- Ping the endpoint: `curl https://mcp-zerotrust-log-ai-456217553981.us-central1.run.app/ping`

---

## Known Issues & Past Debugging

| Symptom | Root Cause | Fix |
|---|---|---|
| `EOF on stdout` | `console.log` polluting MCP stream | Use `process.stderr.write` only |
| `Cannot find module './foo'` | Missing `.js` on relative import | Add `.js` to all relative imports |
| `Cannot find module '/app/dist/index.js'` | Entry file was named `server.ts` | Entry must be `index.ts` → `dist/index.js` |
| `ERR_MODULE_NOT_FOUND` with ts-node-dev | ts-node-dev runs CJS, `.js` imports break it | Use `tsc --watch` + `node dist/index.js` for dev |
| `PORT=8080 not listening` | Was using StdioServerTransport | Switch to HTTP server with StreamableHTTPServerTransport |
| Deployment fails, container exits | AIService constructor threw (missing API key) | Made env check lazy — moved to call time |
| `typescript@6` build errors | TS6 is pre-release/unstable | Pinned to `typescript@5.4.5` |

---

## v2 Roadmap

- [ ] Remote log ingestion (GCS URI, S3 URI, CloudWatch stream)
- [ ] `stream_logs` tool — tail live log streams via MCP
- [ ] Per-user API key support (`credentials_mode: per_user` in MCPize)
- [ ] Structured JSON output mode for pipeline integration
- [ ] Custom whitelist configuration per deployment
- [ ] Multi-file correlation — correlate N log files simultaneously
- [ ] Slack / PagerDuty alert on `incident_report` completion