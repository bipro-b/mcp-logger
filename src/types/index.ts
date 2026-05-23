export interface CommandResult {
  command: string;
  success: boolean;
  output: string;
  error?: string;
  duration_ms: number;
  dry_run: boolean;
  category?: string;
  risk?: string;
  description?: string;
}

export interface VerificationResult {
  resolved: boolean;
  confidence: "high" | "medium" | "low";
  remaining_issues: string[];
  message: string;
}

export interface HealthCheckResult {
  endpoint: string;
  name: string;
  status: "up" | "down" | "degraded";
  http_code?: number;
  response_time_ms: number;
  error?: string;
}

export interface LogCompareResult {
  resolved_errors: string[];
  new_errors: string[];
  unchanged_errors: string[];
  regression_risk: "high" | "medium" | "low" | "none";
  summary: string;
}
