import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/transcribe/route";
import {
  allowRequest, DEFAULT_MODEL, MAX_AUDIO_BYTES, RATE_LIMIT, resetRateLimit, toIsoLanguage, transcribeWithOpenAI,
  TranscriptionError, verifyFirebaseToken,
} from "@/lib/transcribe/server";

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const status = (code: number) => new Response("{}", { status: code });

describe("helpers", () => {
  it("maps browser language tags to the codes we offer", () => {
    expect(toIsoLanguage("en-US")).toBe("en");
    expect(toIsoLanguage("tr-TR")).toBe("tr");
    expect(toIsoLanguage("es-ES")).toBe("es");
    expect(toIsoLanguage("de-DE")).toBeNull();
    expect(toIsoLanguage("")).toBeNull();
  });

  it("verifies a Firebase token through the public lookup endpoint", async () => {
    const f = vi.fn(async () => ok({ users: [{ localId: "user-1" }] }));
    await expect(verifyFirebaseToken("tok/en", "KEY 1", f as never)).resolves.toBe("user-1");
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=KEY%201");
    expect(JSON.parse(init.body as string)).toEqual({ idToken: "tok/en" });
  });
  it("rejects invalid tokens and unknown users", async () => {
    await expect(verifyFirebaseToken("bad", "k", (async () => status(400)) as never)).resolves.toBeNull();
    await expect(verifyFirebaseToken("gone", "k", (async () => ok({ users: [] })) as never)).resolves.toBeNull();
    await expect(verifyFirebaseToken("odd", "k", (async () => ok({})) as never)).resolves.toBeNull();
  });

  it("limits how often one user can transcribe, per user, and recovers", () => {
    resetRateLimit();
    for (let i = 0; i < RATE_LIMIT.max; i++) expect(allowRequest("a", 1000)).toBe(true);
    expect(allowRequest("a", 1000)).toBe(false);
    expect(allowRequest("b", 1000)).toBe(true);
    expect(allowRequest("a", 1000 + RATE_LIMIT.windowMs + 1)).toBe(true);
    resetRateLimit();
  });

  it("sends the recording to OpenAI without any hint about the expected text", async () => {
    const f = vi.fn(async () => ok({ text: "  hello there  " }));
    const text = await transcribeWithOpenAI(new Blob(["x"]), "speech.m4a", "en", { apiKey: "sk-test", fetchImpl: f as never });
    expect(text).toBe("hello there");
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit & { body: FormData }];
    expect(url).toBe("https://api.openai.com/v1/audio/transcriptions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");
    expect(init.body.get("model")).toBe(DEFAULT_MODEL);
    expect(init.body.get("language")).toBe("en");
    expect(init.body.get("response_format")).toBe("json");
    expect((init.body.get("file") as File).name).toBe("speech.m4a");
    expect(init.body.has("prompt")).toBe(false);
  });
  it("lets the model be changed, and reports upstream failures", async () => {
    const f = vi.fn(async () => ok({ text: "x" }));
    await transcribeWithOpenAI(new Blob(["x"]), "a.m4a", "tr", { apiKey: "k", model: "whisper-1", fetchImpl: f as never });
    expect(((f.mock.calls[0] as unknown as [string, { body: FormData }])[1]).body.get("model")).toBe("whisper-1");
    await expect(transcribeWithOpenAI(new Blob(["x"]), "a", "en", { apiKey: "k", fetchImpl: (async () => status(429)) as never })).rejects.toMatchObject({ status: 429 });
    await expect(transcribeWithOpenAI(new Blob(["x"]), "a", "en", { apiKey: "k", fetchImpl: (async () => status(500)) as never })).rejects.toBeInstanceOf(TranscriptionError);
    await expect(transcribeWithOpenAI(new Blob(["x"]), "a", "en", { apiKey: "k", fetchImpl: (async () => ok({})) as never })).resolves.toBe("");
  });
});

describe("the /api/transcribe route", () => {
  const saved = { openai: process.env.OPENAI_API_KEY, fb: process.env.NEXT_PUBLIC_FIREBASE_API_KEY, model: process.env.TRANSCRIBE_MODEL };
  let upstream: ReturnType<typeof vi.fn>;
  let tokenOk = true;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = "sk-test"; process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "fb-key"; delete process.env.TRANSCRIBE_MODEL;
    tokenOk = true; resetRateLimit();
    upstream = vi.fn(async () => ok({ text: "merhaba dünya" }));
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes("identitytoolkit")) return tokenOk ? ok({ users: [{ localId: "u1" }] }) : status(400);
      return upstream(url, init);
    }));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    for (const [k, v] of [["OPENAI_API_KEY", saved.openai], ["NEXT_PUBLIC_FIREBASE_API_KEY", saved.fb], ["TRANSCRIBE_MODEL", saved.model]] as const) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  });

  const request = (opts: { token?: string | null; audio?: Blob | null; lang?: string; raw?: boolean } = {}) => {
    const { token = "good", audio = new Blob(["audio-bytes"], { type: "audio/mp4" }), lang = "tr-TR", raw = false } = opts;
    const headers: Record<string, string> = token ? { authorization: `Bearer ${token}` } : {};
    if (raw) return new Request("http://localhost/api/transcribe", { method: "POST", headers: { ...headers, "content-type": "text/plain" }, body: "nope" });
    const form = new FormData();
    if (audio) form.append("audio", audio, "speech.m4a");
    form.append("lang", lang);
    return new Request("http://localhost/api/transcribe", { method: "POST", headers, body: form });
  };

  it("reports whether it is switched on", async () => {
    expect(await (await GET()).json()).toEqual({ enabled: true });
    delete process.env.OPENAI_API_KEY;
    expect(await (await GET()).json()).toEqual({ enabled: false });
  });
  it("is off until a key is configured", async () => {
    delete process.env.OPENAI_API_KEY;
    expect((await POST(request())).status).toBe(503);
  });
  it("needs a valid signed-in user", async () => {
    expect((await POST(request({ token: null }))).status).toBe(401);
    tokenOk = false;
    expect((await POST(request({ token: "expired" }))).status).toBe(401);
    expect(upstream).not.toHaveBeenCalled(); // no paid call for strangers
  });
  it("transcribes in the right language and returns the text", async () => {
    const res = await POST(request({ lang: "tr-TR" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: "merhaba dünya" });
    const form = (upstream.mock.calls[0]![1] as { body: FormData }).body;
    expect(form.get("language")).toBe("tr");
    expect(form.get("model")).toBe(DEFAULT_MODEL);
  });
  it("uses the configured model", async () => {
    process.env.TRANSCRIBE_MODEL = "whisper-1";
    await POST(request());
    expect(((upstream.mock.calls[0]![1] as { body: FormData }).body).get("model")).toBe("whisper-1");
  });
  it("rejects bad input before spending anything", async () => {
    expect((await POST(request({ raw: true }))).status).toBe(400);
    expect((await POST(request({ audio: null }))).status).toBe(400);
    expect((await POST(request({ audio: new Blob([]) }))).status).toBe(400);
    expect((await POST(request({ lang: "de-DE" }))).status).toBe(400);
    expect((await POST(request({ audio: new Blob([new Uint8Array(MAX_AUDIO_BYTES + 1)]) }))).status).toBe(413);
    expect(upstream).not.toHaveBeenCalled();
  });
  it("applies the per-user rate limit", async () => {
    for (let i = 0; i < RATE_LIMIT.max; i++) expect((await POST(request())).status).toBe(200);
    expect((await POST(request())).status).toBe(429);
  });
  it("turns provider failures into clear statuses", async () => {
    upstream.mockResolvedValueOnce(status(500));
    const a = await POST(request());
    expect(a.status).toBe(502);
    expect(await a.json()).toEqual({ error: "service_error" });
    upstream.mockResolvedValueOnce(status(429));
    expect((await POST(request())).status).toBe(429);
  });
});
