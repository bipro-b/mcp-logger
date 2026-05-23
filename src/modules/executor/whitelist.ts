export interface WhitelistEntry {
  pattern: RegExp;
  category: "kubernetes" | "docker" | "systemctl" | "pm2" | "diagnostics";
  description: string;
  risk: "low" | "medium" | "high";
}

export interface ValidationResult {
  allowed: boolean;
  entry?: WhitelistEntry;
  reason?: string;
}

const SHELL_OPERATORS = /[;&|`$(){}[\]<>\\]/;

export const WHITELIST: WhitelistEntry[] = [
  // Kubernetes (9 patterns)
  { pattern: /^kubectl get pods( -n [\w-]+)?$/, category: "kubernetes", description: "List pods", risk: "low" },
  { pattern: /^kubectl describe pod [\w.-]+ -n [\w-]+$/, category: "kubernetes", description: "Describe a pod", risk: "low" },
  { pattern: /^kubectl logs [\w.-]+( -n [\w-]+)?( --tail=\d+)?$/, category: "kubernetes", description: "Get pod logs", risk: "low" },
  { pattern: /^kubectl rollout restart deployment\/[\w-]+( -n [\w-]+)?$/, category: "kubernetes", description: "Restart a deployment", risk: "medium" },
  { pattern: /^kubectl rollout status deployment\/[\w-]+( -n [\w-]+)?$/, category: "kubernetes", description: "Check rollout status", risk: "low" },
  { pattern: /^kubectl get events( -n [\w-]+)?$/, category: "kubernetes", description: "List cluster events", risk: "low" },
  { pattern: /^kubectl top pods( -n [\w-]+)?$/, category: "kubernetes", description: "Check pod resource usage", risk: "low" },
  { pattern: /^kubectl get nodes$/, category: "kubernetes", description: "List cluster nodes", risk: "low" },
  { pattern: /^kubectl get deployments( -n [\w-]+)?$/, category: "kubernetes", description: "List deployments", risk: "low" },

  // Docker (6 patterns)
  { pattern: /^docker ps( -a)?$/, category: "docker", description: "List containers", risk: "low" },
  { pattern: /^docker logs [\w-]+ --tail \d+$/, category: "docker", description: "Get container logs", risk: "low" },
  { pattern: /^docker restart [\w-]+$/, category: "docker", description: "Restart a container", risk: "medium" },
  { pattern: /^docker stats --no-stream$/, category: "docker", description: "Container resource stats", risk: "low" },
  { pattern: /^docker inspect [\w-]+$/, category: "docker", description: "Inspect a container", risk: "low" },
  { pattern: /^docker system df$/, category: "docker", description: "Docker disk usage", risk: "low" },

  // Systemctl (5 patterns)
  { pattern: /^systemctl status [\w.-]+$/, category: "systemctl", description: "Check service status", risk: "low" },
  { pattern: /^systemctl restart [\w.-]+$/, category: "systemctl", description: "Restart a service", risk: "medium" },
  { pattern: /^systemctl stop [\w.-]+$/, category: "systemctl", description: "Stop a service", risk: "high" },
  { pattern: /^systemctl start [\w.-]+$/, category: "systemctl", description: "Start a service", risk: "medium" },
  { pattern: /^systemctl reload [\w.-]+$/, category: "systemctl", description: "Reload service config", risk: "medium" },

  // PM2 (5 patterns)
  { pattern: /^pm2 (status|list)$/, category: "pm2", description: "List PM2 processes", risk: "low" },
  { pattern: /^pm2 restart [\w-]+$/, category: "pm2", description: "Restart a PM2 app", risk: "medium" },
  { pattern: /^pm2 logs [\w-]+ --lines \d+$/, category: "pm2", description: "Get PM2 app logs", risk: "low" },
  { pattern: /^pm2 reload [\w-]+$/, category: "pm2", description: "Reload a PM2 app", risk: "medium" },
  { pattern: /^pm2 stop [\w-]+$/, category: "pm2", description: "Stop a PM2 app", risk: "high" },

  // Diagnostics (4 patterns)
  { pattern: /^df -h$/, category: "diagnostics", description: "Check disk usage", risk: "low" },
  { pattern: /^free -h$/, category: "diagnostics", description: "Check memory usage", risk: "low" },
  { pattern: /^netstat -tulpn$/, category: "diagnostics", description: "List listening ports", risk: "low" },
  { pattern: /^ps aux$/, category: "diagnostics", description: "List all processes", risk: "low" },
];

export function validateCommand(cmd: string): ValidationResult {
  if (SHELL_OPERATORS.test(cmd)) {
    return { allowed: false, reason: "Command contains forbidden shell operators" };
  }

  const trimmed = cmd.trim();
  for (const entry of WHITELIST) {
    if (entry.pattern.test(trimmed)) {
      return { allowed: true, entry };
    }
  }

  return { allowed: false, reason: `Command not in whitelist: "${trimmed}"` };
}
