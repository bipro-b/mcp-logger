export interface AuditEntry {
  tool: string;
  ip?: string;
  duration_ms?: number;
  success?: boolean;
  commands?: string[];
  dry_run?: boolean;
  approved?: boolean;
  high_risk?: boolean;
  error?: string;
}

export function auditLog(entry: AuditEntry): void {
  const record = JSON.stringify({
    timestamp: new Date().toISOString(),
    type: "audit",
    ...entry,
  });
  process.stderr.write(`[AUDIT] ${record}\n`);
}
