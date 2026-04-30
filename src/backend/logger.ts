import type { JsonRecord } from "./types";

export function logError(message: string, details: JsonRecord = {}) {
  console.error(formatLog("error", message, details));
}

export function errorDetails(error: unknown): JsonRecord {
  if (error instanceof Error) {
    return {
      errorMessage: error.message,
      errorName: error.name,
      stack: error.stack,
    };
  }

  if (typeof error === "string") {
    return { errorMessage: error };
  }

  return { errorMessage: "Unknown error" };
}

function formatLog(level: "error", message: string, details: JsonRecord) {
  const { level: _level, message: _message, ...safeDetails } = details;
  return JSON.stringify({ level, message, ...safeDetails });
}
