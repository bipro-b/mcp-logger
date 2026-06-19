export interface WhitelistEntry {
  pattern: RegExp;
  category: "kubernetes" | "docker" | "systemctl" | "pm2" | "diagnostics" | "redis" | "nginx" | "network";
  description: string;
  risk: "low" | "medium" | "high";
}

export interface ValidationResult {
  allowed: boolean;
  entry?: WhitelistEntry;
  reason?: string;
  normalized?: string; // command after normalization — use this for execution
}

const SHELL_OPERATORS = /[;&|`$(){}[\]<>\\]/;

export const WHITELIST: WhitelistEntry[] = [
  // ── Kubernetes (15 patterns) ─────────────────────────────────────────────
  { pattern: /^kubectl get pods( -n [\w-]+)?$/, category: "kubernetes", description: "List pods", risk: "low" },
  { pattern: /^kubectl get pods -n [\w-]+ -o wide$/, category: "kubernetes", description: "List pods with node info", risk: "low" },
  { pattern: /^kubectl get deployments?( -n [\w-]+)?$/, category: "kubernetes", description: "List deployments", risk: "low" },
  { pattern: /^kubectl get services?( -n [\w-]+)?$/, category: "kubernetes", description: "List services", risk: "low" },
  { pattern: /^kubectl get nodes( -o wide)?$/, category: "kubernetes", description: "List cluster nodes", risk: "low" },
  { pattern: /^kubectl get events( -n [\w-]+)?( --sort-by=\.lastTimestamp)?$/, category: "kubernetes", description: "List cluster events", risk: "low" },
  { pattern: /^kubectl get pvc( -n [\w-]+)?$/, category: "kubernetes", description: "List persistent volume claims", risk: "low" },
  { pattern: /^kubectl get configmap [\w-]+ -n [\w-]+$/, category: "kubernetes", description: "View a configmap", risk: "low" },
  { pattern: /^kubectl describe pod [\w.-]+ -n [\w-]+$/, category: "kubernetes", description: "Describe a pod", risk: "low" },
  { pattern: /^kubectl describe node [\w.-]+$/, category: "kubernetes", description: "Describe a node", risk: "low" },
  { pattern: /^kubectl logs [\w.-]+( -n [\w-]+)?( --tail=\d+)?( -c [\w-]+)?$/, category: "kubernetes", description: "Get pod logs", risk: "low" },
  { pattern: /^kubectl top pods?( -n [\w-]+)?$/, category: "kubernetes", description: "Check pod resource usage", risk: "low" },
  { pattern: /^kubectl top nodes?$/, category: "kubernetes", description: "Check node resource usage", risk: "low" },
  { pattern: /^kubectl rollout restart deployment\/[\w-]+( -n [\w-]+)?$/, category: "kubernetes", description: "Restart a deployment", risk: "medium" },
  { pattern: /^kubectl rollout status deployment\/[\w-]+( -n [\w-]+)?$/, category: "kubernetes", description: "Check rollout status", risk: "low" },
  { pattern: /^kubectl rollout undo deployment\/[\w-]+( -n [\w-]+)?$/, category: "kubernetes", description: "Roll back a deployment", risk: "high" },
  { pattern: /^kubectl scale deployment\/[\w-]+ --replicas=\d+( -n [\w-]+)?$/, category: "kubernetes", description: "Scale a deployment", risk: "medium" },
  { pattern: /^kubectl delete pod [\w.-]+ -n [\w-]+$/, category: "kubernetes", description: "Force-delete a pod (triggers restart)", risk: "high" },

  // ── Docker (8 patterns) ──────────────────────────────────────────────────
  { pattern: /^docker ps( -a)?$/, category: "docker", description: "List containers", risk: "low" },
  { pattern: /^docker logs [\w-]+ --tail \d+$/, category: "docker", description: "Get container logs", risk: "low" },
  { pattern: /^docker inspect [\w-]+$/, category: "docker", description: "Inspect a container", risk: "low" },
  { pattern: /^docker stats --no-stream$/, category: "docker", description: "Container resource stats (one-shot)", risk: "low" },
  { pattern: /^docker system df$/, category: "docker", description: "Docker disk usage", risk: "low" },
  { pattern: /^docker volume ls$/, category: "docker", description: "List docker volumes", risk: "low" },
  { pattern: /^docker network ls$/, category: "docker", description: "List docker networks", risk: "low" },
  { pattern: /^docker restart [\w-]+$/, category: "docker", description: "Restart a container", risk: "medium" },

  // ── Systemctl (5 patterns) ───────────────────────────────────────────────
  { pattern: /^systemctl status [\w.-]+$/, category: "systemctl", description: "Check service status", risk: "low" },
  { pattern: /^systemctl reload [\w.-]+$/, category: "systemctl", description: "Reload service config", risk: "medium" },
  { pattern: /^systemctl restart [\w.-]+$/, category: "systemctl", description: "Restart a service", risk: "medium" },
  { pattern: /^systemctl start [\w.-]+$/, category: "systemctl", description: "Start a service", risk: "medium" },
  { pattern: /^systemctl stop [\w.-]+$/, category: "systemctl", description: "Stop a service", risk: "high" },

  // ── PM2 (5 patterns) ─────────────────────────────────────────────────────
  { pattern: /^pm2 (status|list)$/, category: "pm2", description: "List PM2 processes", risk: "low" },
  { pattern: /^pm2 logs [\w-]+ --lines \d+$/, category: "pm2", description: "Get PM2 app logs", risk: "low" },
  { pattern: /^pm2 reload [\w-]+$/, category: "pm2", description: "Reload a PM2 app", risk: "medium" },
  { pattern: /^pm2 restart [\w-]+$/, category: "pm2", description: "Restart a PM2 app", risk: "medium" },
  { pattern: /^pm2 stop [\w-]+$/, category: "pm2", description: "Stop a PM2 app", risk: "high" },

  // ── Redis (6 patterns) ───────────────────────────────────────────────────
  { pattern: /^redis-cli ping$/, category: "redis", description: "Check Redis connectivity", risk: "low" },
  { pattern: /^redis-cli (info|info memory|info replication|info stats)$/, category: "redis", description: "Get Redis info", risk: "low" },
  { pattern: /^redis-cli DBSIZE$/, category: "redis", description: "Get Redis key count", risk: "low" },
  { pattern: /^redis-cli CONFIG GET [\w-]+$/, category: "redis", description: "Get Redis config value", risk: "low" },
  { pattern: /^redis-cli CONFIG SET maxmemory-policy (allkeys-lru|allkeys-lfu|volatile-lru|noeviction)$/, category: "redis", description: "Set Redis eviction policy", risk: "medium" },
  { pattern: /^redis-cli CONFIG SET maxmemory \d+mb?$/, category: "redis", description: "Set Redis max memory", risk: "medium" },

  // ── Nginx (3 patterns) ───────────────────────────────────────────────────
  { pattern: /^nginx -t$/, category: "nginx", description: "Test nginx config", risk: "low" },
  { pattern: /^nginx -s reload$/, category: "nginx", description: "Reload nginx config", risk: "medium" },
  { pattern: /^nginx -s stop$/, category: "nginx", description: "Stop nginx", risk: "high" },

  // ── Diagnostics (8 patterns) ─────────────────────────────────────────────
  { pattern: /^df -h$/, category: "diagnostics", description: "Check disk usage", risk: "low" },
  { pattern: /^free -h$/, category: "diagnostics", description: "Check memory usage", risk: "low" },
  { pattern: /^ps aux$/, category: "diagnostics", description: "List all processes", risk: "low" },
  { pattern: /^top -b -n 1$/, category: "diagnostics", description: "CPU and process snapshot", risk: "low" },
  { pattern: /^journalctl -u [\w.-]+ -n \d+$/, category: "diagnostics", description: "View service journal logs", risk: "low" },
  { pattern: /^journalctl -u [\w.-]+ --since "[\w\s\-:.]+"$/, category: "diagnostics", description: "View recent service journal logs", risk: "low" },
  { pattern: /^(netstat|ss) -tulpn$/, category: "network", description: "List listening ports", risk: "low" },
  { pattern: /^curl -s http:\/\/localhost:\d+\/(health|ping|status|ready|metrics)$/, category: "network", description: "Check local service health endpoint", risk: "low" },
];

// Normalizes AI-generated command variants to whitelist-compatible format.
// AI models output kubectl commands in inconsistent formats (e.g. "deployment name"
// instead of "deployment/name"). Normalization runs before whitelist check AND before
// execution so the corrected form is what actually runs.
export function normalizeCommand(cmd: string): string {
  // kubectl rollout VERB deployment NAME [-n NS] → deployment/NAME
  let out = cmd.replace(
    /^(kubectl rollout (?:restart|undo|status)) deployment ([^\s/]+)(.*)/,
    "$1 deployment/$2$3"
  );
  // kubectl scale deployment NAME → deployment/NAME
  out = out.replace(
    /^(kubectl scale) deployment ([^\s/]+)(.*)/,
    "$1 deployment/$2$3"
  );
  // kubectl delete pod NAME -n NS (already correct, but trim extra whitespace)
  return out.replace(/\s+/g, " ").trim();
}

export function validateCommand(cmd: string): ValidationResult {
  if (SHELL_OPERATORS.test(cmd)) {
    return { allowed: false, reason: "Command contains forbidden shell operators" };
  }

  const normalized = normalizeCommand(cmd.trim());
  for (const entry of WHITELIST) {
    if (entry.pattern.test(normalized)) {
      return { allowed: true, entry, normalized };
    }
  }

  return { allowed: false, reason: `Command not in whitelist: "${cmd.trim()}"` };
}
