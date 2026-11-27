# Speech recognition on iPhone and iPad

Safari's built-in speech recognizer is unreliable: it can stop hearing after the first recording, ignore some languages
(Turkish in particular), or stall. Lingua Flow cannot fix that engine, so on iPhone/iPad it can use **cloud transcription**
instead. The app records the audio, sends it to a speech-to-text service, and scores the text it gets back.

## Turn it on (free option: Groq)

1. Go to https://console.groq.com and create an account (a free tier exists, no card needed at the time of writing).
2. API Keys, Create API Key. Copy it (it starts with `gsk_`).
3. In Vercel: your project, Settings, Environment Variables. Add `GROQ_API_KEY` with that value (Production, and Preview if you use it). Save.
4. Redeploy: Deployments, the latest one, the three dots, Redeploy. (New variables only apply to new deployments.)
5. Check: open `https://YOUR-SITE.vercel.app/api/transcribe` in a browser. It must show `{"enabled":true}`.
6. On the iPhone, close the site completely and open it again. While recording you now see a level bar, and after you
   stop it says "Transcribing…". If you see "Hearing: …" text instead, the browser engine is still being used.

Paid alternative: set `OPENAI_API_KEY` instead (model `gpt-4o-mini-transcribe`). If both keys are set, OpenAI is used unless
`TRANSCRIBE_PROVIDER=groq`. `TRANSCRIBE_MODEL` overrides the model name if a service renames or retires its default.

## What is sent where

- Only a recording the user just made, only for the signed-in user, and never stored or logged by Lingua Flow.
- The text of the card is never sent, so it cannot bias the result. Silence is not uploaded.
- The audio goes to the service you chose (Groq or OpenAI). Mention that in your privacy policy.
- Limits: the route allows 20 recordings per user per minute. Free tiers have their own limits (Groq's free tier was
  about 20 requests per minute and 2,000 per day when this was written; check console.groq.com for current numbers).

## If it still misbehaves

- The screen can no longer stay stuck on "recording": if the engine stops answering, the attempt is abandoned and a
  message appears. Tap the microphone to try again.
- Without a key, iPhone uses Safari's engine and the problems above can happen. That is the engine, not the app.
