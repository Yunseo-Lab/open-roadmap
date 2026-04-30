import { afterEach, describe, expect, it, vi } from "vitest";
import { errorDetails, logError } from "./logger";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("logger", () => {
  it("writes structured error logs without letting details override the envelope", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logError("Cleanup failed.", {
      level: "info",
      message: "override",
      roadmapId: "roadmap-1",
    });

    const line = spy.mock.calls[0]?.[0];
    expect(typeof line).toBe("string");
    expect(JSON.parse(String(line))).toEqual({
      level: "error",
      message: "Cleanup failed.",
      roadmapId: "roadmap-1",
    });
  });

  it("normalizes Error instances for logs", () => {
    const details = errorDetails(new Error("boom"));

    expect(details).toMatchObject({
      errorMessage: "boom",
      errorName: "Error",
    });
  });
});
