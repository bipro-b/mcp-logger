import { metrics } from "../metrics/metrics.service.js";

export type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
};

export type GeminiErrorResponse = {
  error?: { message?: string; code?: number };
};

const MODEL = "gemini-2.5-flash";
const MAX_RETRIES = 2;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

export class AIService {
  private get endpoint(): string {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY not set");
    return `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
  }

  async analyzeLogs(logs: string[], detectedIssue: string, sources?: string[]): Promise<string> {
    if (!process.env.GEMINI_API_KEY) return this.fallbackResponse(detectedIssue);
    try {
      return await this.generateText(this.buildAnalysisPrompt(logs, detectedIssue, sources));
    } catch (err) {
      process.stderr.write(`AI error: ${err instanceof Error ? err.message : String(err)}\n`);
      return this.fallbackResponse(detectedIssue);
    }
  }

  async generateText(prompt: string): Promise<string> {
    let lastError: Error = new Error("Unknown error");

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const aiStart = Date.now();
      try {
        const result = await this.callGemini(prompt);
        metrics.aiCalls.total++;
        metrics.aiCalls.total_ms += Date.now() - aiStart;
        return result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        metrics.aiCalls.failures++;

        if (attempt < MAX_RETRIES - 1 && this.isRetryable(lastError)) {
          const delay = Math.pow(2, attempt) * 1_000; // 1s, 2s
          metrics.aiCalls.retries++;
          process.stderr.write(`AI retry ${attempt + 1}/${MAX_RETRIES - 1} after ${delay}ms — ${lastError.message}\n`);
          await sleep(delay);
        } else {
          break;
        }
      }
    }

    throw lastError;
  }

  private async callGemini(prompt: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);

    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData: unknown = await response.json().catch(() => ({}));
        const msg = this.parseError(errorData, response.statusText);
        const err = new Error(`HTTP ${response.status}: ${msg}`);
        (err as Error & { status: number }).status = response.status;
        throw err;
      }

      const data = (await response.json()) as GeminiGenerateResponse;
      return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "No response from AI";
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error("AI request timed out after 50s");
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  private isRetryable(err: Error): boolean {
    const msg = err.message;
    if (/HTTP (429|500|502|503|504)/.test(msg)) return true;
    if (/timed out|network|fetch failed|ECONNRESET/i.test(msg)) return true;
    const status = (err as Error & { status?: number }).status;
    return status !== undefined && RETRYABLE_STATUS.has(status);
  }

  private buildAnalysisPrompt(logs: string[], issue: string, sources?: string[]): string {
    const multiServiceNote =
      sources && sources.length > 1
        ? `These logs come from ${sources.length} services: ${sources.join(", ")}. Identify cross-service cascade patterns and the originating service.\n\n`
        : "";

    return `You are a senior SRE with 10+ years of production incident response.

Logs have been sanitized — sensitive data replaced with [REDACTED_*] placeholders.

${multiServiceNote}Return EXACTLY this format, no extra text:

ROOT_CAUSE:
<Single sentence: the originating failure, not a symptom>

IMPACT:
<Which services or users were affected and how>

FIX_COMMANDS:
<One command per line — exact commands only, no numbering or inline comments>

EXPLANATION:
<2-3 sentences: failure chain from root cause to visible impact>

CONFIDENCE: <HIGH|MEDIUM|LOW>
CONFIDENCE_REASON: <One sentence>

WATCH_AFTER_FIX:
<Log pattern or metric that confirms the fix worked>

---
Issue category: ${issue}

Log data:
${logs.join("\n")}`;
  }

  private parseError(errorData: unknown, fallback: string): string {
    if (typeof errorData === "object" && errorData !== null && "error" in errorData) {
      const err = errorData as GeminiErrorResponse;
      return err.error?.message ?? fallback;
    }
    return fallback;
  }

  private fallbackResponse(issue: string): string {
    return `⚠️ AI analysis unavailable.\n🔍 Detected: ${issue}\nConfigure your API key to enable AI-powered root cause analysis.`;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
