"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIService = void 0;
const dotenv = __importStar(require("dotenv"));
dotenv.config();
class AIService {
    API_KEY;
    // private readonly MODEL = "gemini-3-flash-preview";
    MODEL = "gemini-2.5-flash";
    ENDPOINT;
    constructor() {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error("GEMINI_API_KEY is not set in environment variables");
        }
        this.API_KEY = process.env.GEMINI_API_KEY;
        this.ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${this.MODEL}:generateContent?key=${this.API_KEY}`;
    }
    async analyzeLogs(logs, detectedIssue) {
        const prompt = this.buildPrompt(logs, detectedIssue);
        try {
            return await this.callLLM(prompt);
        }
        catch (error) {
            console.error("AI Analysis failed:", error);
            return this.mockResponse(detectedIssue);
        }
    }
    buildPrompt(logs, issue) {
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
    async callLLM(prompt) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 50000);
        try {
            const response = await fetch(this.ENDPOINT, {
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
                const errorData = await response.json();
                throw new Error(this.parseError(errorData, response.statusText));
            }
            const data = (await response.json());
            return (data.candidates?.[0]?.content?.parts?.[0]?.text ??
                "No response from AI");
        }
        catch (error) {
            if (error instanceof Error && error.name === "AbortError") {
                throw new Error("Gemini API request timed out");
            }
            throw error;
        }
        finally {
            clearTimeout(timeout);
        }
    }
    parseError(errorData, fallback) {
        if (typeof errorData === "object" &&
            errorData !== null &&
            "error" in errorData) {
            const err = errorData;
            return err.error?.message ?? fallback;
        }
        return fallback;
    }
    mockResponse(issue) {
        return `
⚠️ [Fallback Mode] AI Analysis unavailable.
🔍 Issue: ${issue}
Check API key, quota, or network.
`;
    }
}
exports.AIService = AIService;
