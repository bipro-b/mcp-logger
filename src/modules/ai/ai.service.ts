import * as dotenv from 'dotenv';
dotenv.config({ quiet: true });

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

export class AIService {
  private readonly API_KEY: string;
  // private readonly MODEL = "gemini-3-flash-preview";
  private readonly MODEL = "gemini-2.5-flash";
  private readonly ENDPOINT: string;

  
  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set in environment variables");
    }


    this.API_KEY = process.env.GEMINI_API_KEY;
    this.ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${this.MODEL}:generateContent?key=${this.API_KEY}`;
  }

  async analyzeLogs(logs: string[], detectedIssue: string): Promise<string> {
    const prompt = this.buildPrompt(logs, detectedIssue);

    try {
      return await this.callLLM(prompt);
    } catch (error: unknown) {
      console.error("AI Analysis failed:", error);
      return this.mockResponse(detectedIssue);
    }
  }

  private buildPrompt(logs: string[], issue: string): string {
    return `
You are a senior DevOps SRE.

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
${logs.join("\n")}
`;
  }

  private async callLLM(prompt: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 50000);

    try {
      const response: Response = await fetch(this.ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData: unknown = await response.json();
        throw new Error(this.parseError(errorData, response.statusText));
      }

     const data = (await response.json()) as GeminiGenerateResponse;

      return (
        data.candidates?.[0]?.content?.parts?.[0]?.text ??
        "No response from AI"
      );
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Gemini API request timed out");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private parseError(errorData: unknown, fallback: string): string {
    if (
      typeof errorData === "object" &&
      errorData !== null &&
      "error" in errorData
    ) {
      const err = errorData as GeminiErrorResponse;
      return err.error?.message ?? fallback;
    }
    return fallback;
  }

  private mockResponse(issue: string): string {
    return `
⚠️ [Fallback Mode] AI Analysis unavailable.
🔍 Issue: ${issue}
Check API key, quota, or network.
`;
  }
}