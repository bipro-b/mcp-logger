"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIService = void 0;
const MODEL = "gemini-2.5-flash";
class AIService {
    get endpoint() {
        const key = process.env.GEMINI_API_KEY;
        if (!key)
            throw new Error("GEMINI_API_KEY not set");
        return `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
    }
    async analyzeLogs(logs, detectedIssue) {
        if (!process.env.GEMINI_API_KEY)
            return this.fallbackResponse(detectedIssue);
        try {
            return await this.generateText(this.buildAnalysisPrompt(logs, detectedIssue));
        }
        catch (err) {
            process.stderr.write(`AI analysis error: ${err instanceof Error ? err.message : String(err)}\n`);
            return this.fallbackResponse(detectedIssue);
        }
    }
    async generateText(prompt) {
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
                const errorData = await response.json();
                throw new Error(this.parseError(errorData, response.statusText));
            }
            const data = (await response.json());
            return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "No response from AI";
        }
        catch (err) {
            if (err instanceof Error && err.name === "AbortError") {
                throw new Error("Gemini API request timed out");
            }
            throw err;
        }
        finally {
            clearTimeout(timeout);
        }
    }
    buildAnalysisPrompt(logs, issue) {
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
    parseError(errorData, fallback) {
        if (typeof errorData === "object" && errorData !== null && "error" in errorData) {
            const err = errorData;
            return err.error?.message ?? fallback;
        }
        return fallback;
    }
    fallbackResponse(issue) {
        return `⚠️ [Fallback Mode] AI Analysis unavailable.\n🔍 Issue: ${issue}\nCheck API key, quota, or network.`;
    }
}
exports.AIService = AIService;
