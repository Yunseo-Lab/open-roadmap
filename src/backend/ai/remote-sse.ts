export type SseEvent = {
  event: string;
  data: string;
};

// Pulls complete SSE blocks out of a streaming text buffer.
export function popSseEvents(buffer: string): { messages: SseEvent[]; remaining: string } {
  const messages: SseEvent[] = [];
  let remaining = buffer;

  while (true) {
    const separator = remaining.search(/\r?\n\r?\n/);
    if (separator === -1) {
      return { messages, remaining };
    }

    const block = remaining.slice(0, separator);
    remaining = remaining.slice(separator + (remaining[separator] === "\r" ? 4 : 2));
    const event = parseSseBlock(block);
    if (event) {
      messages.push(event);
    }
  }
}

// Parses the small subset of SSE syntax emitted by the remote service.
export function parseSseBlock(block: string): SseEvent | null {
  let event = "message";
  const data: string[] = [];

  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
    }
    if (line.startsWith("data:")) {
      data.push(line.slice("data:".length).trimStart());
    }
  }

  if (!data.length) {
    return null;
  }

  return { event, data: data.join("\n") };
}

// Bad event JSON is ignored so one malformed progress event does not kill the run.
export function parseSseData(data: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(data) as unknown;
    if (isRecord(parsed)) {
      return parsed;
    }
  } catch {
    return {};
  }
  return {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
