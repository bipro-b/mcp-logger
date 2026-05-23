export type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

export type GeminiErrorResponse = {
  error?: {
    message?: string;
  };
};

const MODEL = "gemini-2.5-flash";

export class AIService {
  private get endpoint(): string {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY not set");
    return `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
  }

  async analyzeLogs(logs: string[], detectedIssue: string): Promise<string> {
    if (!process.env.GEMINI_API_KEY) return this.fallbackResponse(detectedIssue);
    try {
      return await this.generateText(this.buildAnalysisPrompt(logs, detectedIssue));
    } catch (err) {
      process.stderr.write(`AI analysis error: ${err instanceof Error ? err.message : String(err)}\n`);
      return this.fallbackResponse(detectedIssue);
    }
  }

  async generateText(prompt: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 50_000);

    try {
      const response = await fetch(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData: unknown = await response.json();
        throw new Error(this.parseError(errorData, response.statusText));
      }

      const data = (await response.json()) as GeminiGenerateResponse;
      return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "No response from AI";
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error("Gemini API request timed out");
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildAnalysisPrompt(logs: string[], issue: string): string {
    return `You are a senior DevOps SRE.

Return ONLY in this format:

Root Cause:
<cause>

Fix:
<commands + steps>

Explanation:
<short explanation>

Detected Issue:
${issue}

Logs:
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
    return `⚠️ [Fallback Mode] AI Analysis unavailable.\n🔍 Issue: ${issue}\nCheck API key, quota, or network.`;
  }
}
