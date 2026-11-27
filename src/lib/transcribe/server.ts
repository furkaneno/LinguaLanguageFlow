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

export type TranscribeProvider = "openai" | "groq";
export interface ProviderConfig { provider: TranscribeProvider; apiKey: string; model: string; url: string }
export const PROVIDER_URLS: Record<TranscribeProvider, string> = {
  openai: "https://api.openai.com/v1/audio/transcriptions",
  groq: "https://api.groq.com/openai/v1/audio/transcriptions",
};
export const PROVIDER_MODELS: Record<TranscribeProvider, string> = { openai: DEFAULT_MODEL, groq: "whisper-large-v3-turbo" };

/**
 * Picks the speech-to-text service from the environment: set GROQ_API_KEY (free tier available) or OPENAI_API_KEY.
 * If both are set, OpenAI is used unless TRANSCRIBE_PROVIDER says "groq". Returns null when no key is set (feature off).
 */
export function resolveProvider(env: Record<string, string | undefined>): ProviderConfig | null {
  const keys: Record<TranscribeProvider, string | undefined> = { openai: env.OPENAI_API_KEY || undefined, groq: env.GROQ_API_KEY || undefined };
  const wanted = env.TRANSCRIBE_PROVIDER?.trim().toLowerCase();
  const provider: TranscribeProvider | null =
    wanted === "groq" && keys.groq ? "groq" : wanted === "openai" && keys.openai ? "openai" : keys.openai ? "openai" : keys.groq ? "groq" : null;
  if (!provider) return null;
  return { provider, apiKey: keys[provider]!, model: env.TRANSCRIBE_MODEL || PROVIDER_MODELS[provider], url: PROVIDER_URLS[provider] };
}

/** Sends one recording to the chosen service. The expected text is deliberately NOT sent as a hint, so it can't bias the result. */
export async function transcribeAudio(
  audio: Blob, filename: string, language: string,
  cfg: ProviderConfig, fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const form = new FormData();
  form.append("file", audio, filename);
  form.append("model", cfg.model);
  form.append("language", language);
  form.append("response_format", "json");
  const res = await fetchImpl(cfg.url, { method: "POST", headers: { Authorization: `Bearer ${cfg.apiKey}` }, body: form });
  if (!res.ok) throw new TranscriptionError(res.status === 429 ? 429 : 502);
  const data = (await res.json()) as { text?: unknown };
  return typeof data.text === "string" ? data.text.trim() : "";
}

/** OpenAI-only form, kept for callers that pass a key and model directly. */
export function transcribeWithOpenAI(
  audio: Blob, filename: string, language: string,
  opts: { apiKey: string; model?: string | undefined; fetchImpl?: typeof fetch },
): Promise<string> {
  return transcribeAudio(audio, filename, language, { provider: "openai", apiKey: opts.apiKey, model: opts.model || DEFAULT_MODEL, url: PROVIDER_URLS.openai }, opts.fetchImpl);
}
