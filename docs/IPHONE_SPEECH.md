# Speech on iPhone and iPad

Safari's built-in speech recognizer is unreliable: after audio playback it can stay in a "listening" state that never reports anything,
and it ends sessions early. Lingua Flow therefore has two engines:

| Device | Engine | What happens |
|---|---|---|
| Android, Windows, Mac | Browser recognizer (Web Speech API) | Audio is processed by the browser's own speech service. |
| iPhone, iPad | **Cloud transcription**, when switched on | The phone records the microphone and sends the recording to `/api/transcribe`, which has OpenAI transcribe it. |
| iPhone, iPad without the key | Browser recognizer | Works as far as Safari allows. |

Both engines can never freeze the screen: if the browser stops answering, the app gives up after a few seconds with a clear message.

## Turning cloud transcription on
1. Create an OpenAI API key (platform.openai.com) and add a payment method. Set a monthly spending limit there.
2. In Vercel: Project, Settings, Environment Variables. Add `OPENAI_API_KEY` (Production). Optionally add `TRANSCRIBE_MODEL`.
3. Redeploy. Open the study screen on an iPhone: it now shows a level bar and "Transcribing…".

Without `OPENAI_API_KEY` nothing changes and nothing is sent anywhere.

## Cost, privacy, limits
- Transcription is billed per minute of audio by OpenAI; check the current price before enabling. Silence is never uploaded.
- Only signed-in users can use the route, at most 20 recordings per minute each (best effort on serverless).
- Recordings are passed through and never stored or logged by Lingua Flow. OpenAI's own data policy applies to what it receives.
- The expected card text is never sent along, so it cannot influence the transcription.
- Update your privacy policy: on iPhone/iPad the audio is processed by OpenAI.

## If it still misbehaves on an iPhone
- Safari: Settings, Safari, Microphone: Allow (or Ask).
- Use Safari, not an in-app browser (Instagram, WhatsApp links).
- Without the key: Settings, General, Keyboard, Enable Dictation must be on.
