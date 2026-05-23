import { requestContext } from "./request-context.js";

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
  source?: string;
  resolved?: boolean;
  incident_id?: string;
  endpoint_count?: number;
  regression_risk?: string;
  lines_ingested?: number;
}

export function auditLog(entry: AuditEntry): void {
  const ctx = requestContext.getStore();
  const record = JSON.stringify({
    timestamp: new Date().toISOString(),
    type: "audit",
    request_id: ctx?.requestId,
    ...entry,
  });
  process.stderr.write(`[AUDIT] ${record}\n`);
}
