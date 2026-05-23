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
    async analyzeLogs(logs, detectedIssue, sources) {
        if (!process.env.GEMINI_API_KEY)
            return this.fallbackResponse(detectedIssue);
        try {
            return await this.generateText(this.buildAnalysisPrompt(logs, detectedIssue, sources));
        }
        catch (err) {
            process.stderr.write(`AI error: ${err instanceof Error ? err.message : String(err)}\n`);
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
                throw new Error("AI request timed out after 50s");
            }
            throw err;
        }
        finally {
            clearTimeout(timeout);
        }
    }
    buildAnalysisPrompt(logs, issue, sources) {
        const multiServiceNote = sources && sources.length > 1
            ? `These logs come from ${sources.length} services: ${sources.join(", ")}. Look for cross-service cascade patterns and identify which service originated the failure.\n\n`
            : "";
        return `You are a senior SRE with 10+ years of production incident response experience.

The logs below have been sanitized — sensitive data is replaced with [REDACTED_*] placeholders.

${multiServiceNote}Return EXACTLY this format. No extra text before or after:

ROOT_CAUSE:
<Single sentence: the actual originating failure, not a symptom. Example: "Redis pod was OOM-killed due to missing maxmemory-policy, causing connection pool exhaustion upstream.">

IMPACT:
<Which services or users were affected and how severely>

FIX_COMMANDS:
<Each command on its own line. Exact commands only — no inline explanations, no numbering>

EXPLANATION:
<2-3 sentences describing the failure chain from root cause to visible impact>

CONFIDENCE: <HIGH|MEDIUM|LOW>
CONFIDENCE_REASON: <One sentence — why you are or are not confident>

WATCH_AFTER_FIX:
<What log pattern or metric confirms the fix worked>

---
Issue category detected: ${issue}

Log data:
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
        return `⚠️ AI analysis unavailable — no API key configured.\n🔍 Detected: ${issue}\nConfigure GEMINI_API_KEY to enable AI-powered root cause analysis.`;
    }
}
exports.AIService = AIService;
