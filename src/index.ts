import * as dotenv from "dotenv";
dotenv.config({ quiet: true });

import { startServer } from "./mcp/mcpServer.js";

startServer()
  .then((server) => {
    const shutdown = (signal: string): void => {
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
