import { AIService } from "../modules/ai/ai.service.js";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

/**
 * Generates 1,000 lines of complex, multi-service failure logs.
 */
function generateChaosLogs(): string[] {
  const logs: string[] = [];
  const now = new Date();

  // 1. [Lines 1-250] DNS Infrastructure Degradation (The Silent Killer)
  for (let i = 0; i < 250; i++) {
    const timestamp = new Date(now.getTime() - (1000 - i) * 1000).toISOString();
    if (i % 20 === 0) {
      logs.push(`${timestamp} ERROR [kube-dns] code=EAI_AGAIN, message="getaddrinfo timeout" target="redis-master.cache.svc.cluster.local"`);
    } else {
      logs.push(`${timestamp} INFO [auth-service] Health check passed. CPU: 15%`);
    }
  }

  // 2. [Lines 251-600] Database Deadlock & Connection Leaks
  for (let i = 0; i < 350; i++) {
    const timestamp = new Date(now.getTime() - (750 - i) * 1000).toISOString();
    if (i === 150) {
      logs.push(`${timestamp} CRITICAL [postgres-main] deadlock detected. Process 8812 waiting for ShareLock on transaction 1055`);
    } else if (i % 15 === 0) {
      logs.push(`${timestamp} WARN [inventory-service] Connection pool saturated. Active: 98/100.`);
    } else {
      logs.push(`${timestamp} DEBUG [inventory-service] Heartbeat check...`);
    }
  }

  // 3. [Lines 601-900] Security Event: Brute Force Attempt
  for (let i = 0; i < 300; i++) {
    const timestamp = new Date(now.getTime() - (400 - i) * 1000).toISOString();
    if (i % 5 === 0 && i < 100) {
      logs.push(`${timestamp} WARN [auth-service] Failed login attempt. User: root, IP: 192.168.1.210`);
    } else if (i === 101) {
      logs.push(`${timestamp} ALERT [waf-node] Source IP 192.168.1.210 rate-limited. Rule: Brute_Force_Detected`);
    } else {
      logs.push(`${timestamp} INFO [auth-service] Processing JWT validation...`);
    }
  }

  // 4. [Lines 901-1000] Final System Instability
  for (let i = 0; i < 100; i++) {
    const timestamp = new Date(now.getTime() - (100 - i) * 1000).toISOString();
    if (i === 50) logs.push(`${timestamp} ERROR [redis-client] Redis connection lost. Cause: DNS resolution failed`);
    logs.push(`${timestamp} INFO [k8s] Event: Pod redis-dependent-service entering CrashLoopBackOff`);
  }

  return logs;
}

async function run() {
  const aiService = new AIService();
  
  console.log("🛠️ Generating 1,000 lines of chaos logs...");
  const logs = generateChaosLogs();
  
  // Note: The detected issue is what the "user" or "monitor" initially sees
  const detectedIssue = "Redis connection lost in production";

  console.log("🚀 Sending 1,000 lines to Gemini 3 Flash (this may take 15-30s)...");
  
  const startTime = Date.now();
  try {
    const result = await aiService.analyzeLogs(logs, detectedIssue);
    const duration = (Date.now() - startTime) / 1000;

    console.log(`\nAI Analysis Complete in ${duration}s`);
    console.log("==================== AI RESULT ====================");
    console.log(result);
    console.log("====================================================");
  } catch (err) {
    console.error("Test failed:", err);
  }
}

run();