/** Server-side helpers for the cloud speech-to-text route. Nothing here runs in the browser. */
export const MAX_AUDIO_BYTES = 4 * 1024 * 1024; // Vercel functions accept request bodies up to roughly 4.5 MB
export const RATE_LIMIT = { max: 20, windowMs: 60_000 } as const;
/** Override with the TRANSCRIBE_MODEL environment variable if OpenAI retires or renames this one. */
export const DEFAULT_MODEL = "gpt-4o-mini-transcribe";
export const ALLOWED_LANGUAGES = ["en", "tr", "es"] as const;

/** "en-US" -> "en" (the API wants an ISO-639-1 code). Returns null for languages we don't offer. */
export function toIsoLanguage(bcp47: string): string | null {
  const code = bcp47.split("-")[0]?.toLowerCase() ?? "";
  return (ALLOWED_LANGUAGES as readonly string[]).includes(code) ? code : null;
}

/**
 * Checks a Firebase ID token through Google's public lookup endpoint, so no service-account secret is needed.
 * Returns the user's id, or null if the token is invalid, expired, or the user no longer exists.
 */
export async function verifyFirebaseToken(idToken: string, webApiKey: string, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  const res = await fetchImpl(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(webApiKey)}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { users?: { localId?: string }[] };
  return data.users?.[0]?.localId ?? null;
}

const hits = new Map<string, number[]>();

/** Best-effort limit per user (serverless instances don't share memory, so it is a guard rail, not a guarantee). */
export function allowRequest(uid: string, now: number = Date.now()): boolean {
  const recent = (hits.get(uid) ?? []).filter((t) => now - t < RATE_LIMIT.windowMs);
  if (recent.length >= RATE_LIMIT.max) { hits.set(uid, recent); return false; }
  recent.push(now);
  hits.set(uid, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (v.every((t) => now - t >= RATE_LIMIT.windowMs)) hits.delete(k);
  return true;
}
export const resetRateLimit = () => hits.clear();

export class TranscriptionError extends Error {
  constructor(readonly status: number) { super(`Transcription failed (${status})`); this.name = "TranscriptionError"; }
}

/** Sends one recording to OpenAI. The expected text is deliberately NOT sent as a hint, so it can't bias the result. */
export async function transcribeWithOpenAI(
  audio: Blob, filename: string, language: string,
  opts: { apiKey: string; model?: string | undefined; fetchImpl?: typeof fetch },
): Promise<string> {
  const form = new FormData();
  form.append("file", audio, filename);
  form.append("model", opts.model || DEFAULT_MODEL);
  form.append("language", language);
  form.append("response_format", "json");
  const res = await (opts.fetchImpl ?? fetch)("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST", headers: { Authorization: `Bearer ${opts.apiKey}` }, body: form,
  });
  if (!res.ok) throw new TranscriptionError(res.status === 429 ? 429 : 502);
  const data = (await res.json()) as { text?: unknown };
  return typeof data.text === "string" ? data.text.trim() : "";
}
