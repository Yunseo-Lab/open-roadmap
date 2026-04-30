import { describe, expect, it } from "vitest";
import {
  HttpError,
  optionalString,
  readJson,
  requiredCleanText,
  responseStatusFromError,
  stringArray,
} from "./http";

describe("readJson", () => {
  it("parses JSON objects", async () => {
    await expect(readJson(new Request("https://example.com", { body: '{"title":"Roadmap"}', method: "POST" })))
      .resolves.toEqual({ title: "Roadmap" });
  });

  it("keeps empty bodies optional", async () => {
    await expect(readJson(new Request("https://example.com", { method: "POST" }))).resolves.toEqual({});
  });

  it("rejects malformed JSON", async () => {
    await expect(readJson(new Request("https://example.com", { body: "{", method: "POST" }))).rejects.toMatchObject({
      status: 400,
      message: "Request body must be valid JSON.",
    } satisfies Partial<HttpError>);
  });

  it("rejects non-object JSON", async () => {
    await expect(readJson(new Request("https://example.com", { body: "[]", method: "POST" }))).rejects.toMatchObject({
      status: 400,
      message: "Request body must be a JSON object.",
    } satisfies Partial<HttpError>);
  });
});

describe("responseStatusFromError", () => {
  it("preserves safe HttpError statuses", () => {
    expect(responseStatusFromError(new HttpError(404, "Missing."))).toBe(404);
  });

  it("preserves selected upstream service statuses", () => {
    expect(responseStatusFromError({ statusCode: 429 })).toBe(429);
    expect(responseStatusFromError({ statusCode: 502 })).toBe(502);
    expect(responseStatusFromError({ statusCode: 503 })).toBe(503);
  });

  it("hides unknown statuses behind 500", () => {
    expect(responseStatusFromError({ statusCode: 418 })).toBe(500);
    expect(responseStatusFromError(new Error("boom"))).toBe(500);
  });
});

describe("request body helpers", () => {
  it("normalizes optional strings", () => {
    expect(optionalString("  node-1  ")).toBe("node-1");
    expect(optionalString("   ")).toBeUndefined();
    expect(optionalString(null)).toBeUndefined();
  });

  it("keeps only string array entries", () => {
    expect(stringArray([" a ", 1, "b", " ", null])).toEqual(["a", "b"]);
    expect(stringArray("a")).toEqual([]);
  });

  it("requires cleaned text", () => {
    expect(requiredCleanText("  hello  ", "Required.", 4)).toBe("hell");
    expect(() => requiredCleanText(" ", "Required.", 10)).toThrow(HttpError);
  });
});
