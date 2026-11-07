import {
  allowRequest, MAX_AUDIO_BYTES, toIsoLanguage, transcribeWithOpenAI, TranscriptionError, verifyFirebaseToken,
} from "@/lib/transcribe/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Tells the app whether cloud transcription is switched on (an API key is configured). */
export async function GET() {
  return json({ enabled: Boolean(process.env.OPENAI_API_KEY) });
}

/** Transcribes one recording for a signed-in user. Audio is passed straight through and never stored or logged. */
export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  const firebaseKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey || !firebaseKey) return json({ error: "not_configured" }, 503);

  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "unauthorized" }, 401);
  let uid: string | null;
  try { uid = await verifyFirebaseToken(token, firebaseKey); }
  catch { return json({ error: "auth_unavailable" }, 502); }
  if (!uid) return json({ error: "unauthorized" }, 401);
  if (!allowRequest(uid)) return json({ error: "rate_limited" }, 429);

  let form: FormData;
  try { form = await req.formData(); } catch { return json({ error: "bad_request" }, 400); }
  const audio = form.get("audio");
  const language = toIsoLanguage(String(form.get("lang") ?? ""));
  if (!(audio instanceof Blob) || audio.size === 0) return json({ error: "bad_request" }, 400);
  if (audio.size > MAX_AUDIO_BYTES) return json({ error: "too_large" }, 413);
  if (!language) return json({ error: "unsupported_language" }, 400);

  try {
    const text = await transcribeWithOpenAI(audio, (audio as File).name || "speech.m4a", language, { apiKey, model: process.env.TRANSCRIBE_MODEL });
    return json({ text });
  } catch (e) {
    return json({ error: "service_error" }, e instanceof TranscriptionError && e.status === 429 ? 429 : 502);
  }
}
