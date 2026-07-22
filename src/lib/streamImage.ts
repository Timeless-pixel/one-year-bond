// Client SSE parser for the /api/generate-portrait stream.
// Yields data URLs to onFrame; second arg indicates the final frame.
export async function streamImage(
  endpoint: string,
  prompt: string,
  onFrame: (dataUrl: string, isFinal: boolean) => void,
): Promise<void> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok || !res.body) throw new Error(`Image gen failed: ${res.status}`);

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let sawCompleted = false;
  let streamError: string | undefined;

  const handleEvent = (rawEvent: string) => {
    const lines = rawEvent.split("\n");
    let eventName = "message";
    let dataStr = "";
    for (const line of lines) {
      if (line.startsWith("event:")) eventName = line.slice(6).trim();
      else if (line.startsWith("data:")) dataStr += line.slice(5).trim();
    }
    if (!dataStr) return;
    let payload: any;
    try {
      payload = JSON.parse(dataStr);
    } catch {
      return;
    }
    if (eventName === "error" || payload?.type === "error") {
      streamError = payload?.error?.message ?? "Image generation failed";
      return;
    }
    if (
      eventName === "image_generation.partial_image" ||
      eventName === "image_generation.completed"
    ) {
      const isFinal = eventName === "image_generation.completed";
      if (payload?.b64_json) {
        onFrame(`data:image/png;base64,${payload.b64_json}`, isFinal);
        if (isFinal) sawCompleted = true;
      }
    }
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const evt = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        handleEvent(evt);
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  if (streamError) throw new Error(streamError);
  if (!sawCompleted) throw new Error("Image stream ended without a completed event");
}
