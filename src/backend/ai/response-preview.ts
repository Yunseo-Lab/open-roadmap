// Reads a bounded response preview for upstream error messages.
export async function readResponsePreview(response: Response, maxBytes = 2048): Promise<string> {
  if (!response.body) {
    return "";
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (totalBytes < maxBytes) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (!value) {
        continue;
      }

      const availableBytes = maxBytes - totalBytes;
      const chunk = value.byteLength > availableBytes ? value.slice(0, availableBytes) : value;
      chunks.push(chunk);
      totalBytes += chunk.byteLength;

      if (value.byteLength > availableBytes) {
        break;
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(bytes).trim();
}
