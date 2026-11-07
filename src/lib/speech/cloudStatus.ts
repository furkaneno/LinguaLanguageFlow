/** Asks the server whether cloud transcription is configured. Any failure simply means "not available". */
export async function isCloudTranscriptionEnabled(timeoutMs = 3000): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch("/api/transcribe", { cache: "no-store", signal: ctrl.signal });
    if (!res.ok) return false;
    return ((await res.json()) as { enabled?: unknown }).enabled === true;
  } catch { return false; }
  finally { clearTimeout(timer); }
}
