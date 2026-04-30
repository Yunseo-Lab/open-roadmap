import { describe, expect, it } from "vitest";
import { parseSseBlock, parseSseData, popSseEvents } from "./remote-sse";

describe("remote SSE helpers", () => {
  it("pops complete events and leaves partial data buffered", () => {
    const result = popSseEvents(
      'event: status\ndata: {"message":"one"}\n\nevent: final\ndata: {"ok":true}\n\nevent: status\ndata:',
    );

    expect(result.messages).toEqual([
      { event: "status", data: '{"message":"one"}' },
      { event: "final", data: '{"ok":true}' },
    ]);
    expect(result.remaining).toBe("event: status\ndata:");
  });

  it("parses a final event without requiring a trailing blank line", () => {
    expect(parseSseBlock('event: final\ndata: {"ok":true}')).toEqual({
      event: "final",
      data: '{"ok":true}',
    });
  });

  it("ignores malformed JSON event data", () => {
    expect(parseSseData("{")).toEqual({});
  });
});
