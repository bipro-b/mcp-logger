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
const dotenv = __importStar(require("dotenv"));
dotenv.config({ quiet: true });
const mcpServer_js_1 = require("./mcp/mcpServer.js");
(0, mcpServer_js_1.startServer)()
    .then((server) => {
    const shutdown = (signal) => {
        process.stderr.write(`${signal} received — shutting down gracefully\n`);
        server.close(() => {
            process.stderr.write("Server closed — all connections finished\n");
            process.exit(0);
        });
        // Force exit after 30s if connections won't drain
        setTimeout(() => {
            process.stderr.write("Force shutdown after 30s\n");
            process.exit(1);
        }, 30_000).unref();
    };
    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
})
    .catch((err) => {
    process.stderr.write(`Server failed to start: ${err}\n`);
    process.exit(1);
});
