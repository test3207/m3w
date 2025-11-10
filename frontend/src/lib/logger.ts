import pino from "pino";

// Simplified logger without pino-pretty to avoid worker thread issues in Next.js
// Outputs JSON logs that can be processed by external log aggregation tools
export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
});
