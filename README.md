https://lingua-language.vercel.app/
<img width="1910" height="861" alt="image" src="https://github.com/user-attachments/assets/7231c97b-85e0-4a76-b374-0a9b5b2a2eed" />
<img width="1917" height="863" alt="image" src="https://github.com/user-attachments/assets/0a83f583-9a14-4c31-abcf-a00f7cb38bf3" />
<img width="1906" height="862" alt="image" src="https://github.com/user-attachments/assets/fdd0a66e-dfdc-4208-89d8-0b7697293bff" />
<img width="1882" height="861" alt="image" src="https://github.com/user-attachments/assets/f35db0e6-75ed-454a-ab89-4742edfe2064" />

# Lingua Flow

Voice-first English–Turkish card learning. Status: stage 3 (auth, classes, cards, bulk import, voice study). The PWA install and final deployment polish are not done.

## Run locally
1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in your Firebase web app values.
3. In Firebase console: enable **Authentication > Email/Password** and create a **Cloud Firestore** database.
4. Deploy the rules: `npx firebase-tools login && npx firebase-tools deploy --only firestore:rules --project <your-project-id>`
   (without this step every database call fails with a permission error).
5. `npm run dev`, then open http://localhost:3000.

## Scripts
`npm run dev | build | lint | typecheck | test`

## Bulk import
One card per line: `English text | Turkish meaning`. CSV needs UTF-8 and `english`/`turkish` header columns. Imported CSV rows load into the editor so you can fix them before saving.

## Deploying to Vercel
Add the six `NEXT_PUBLIC_FIREBASE_*` variables in the Vercel project settings, and add your Vercel domain under Firebase **Authentication > Settings > Authorized domains**.

## Voice study: how it works and what it can't do
- **Recognition** uses the browser's Web Speech API (Chrome, Edge, Safari). Firefox is unsupported. It needs HTTPS or localhost and an internet connection. In Chrome the audio is processed by the browser's speech service, not by this app. Lingua Flow never records or stores audio.
- **English score** is a *speech-recognition match*: your device's transcript compared with the target text. It is **not** a phonetic pronunciation score and can't tell you which sounds were off. The best of the recognizer's alternative transcripts is used.
- **Turkish score** is a conservative word match against the saved meaning, ignoring case, punctuation and diacritics. It does not understand paraphrases, and an extra word can lower the score below 80%.
- Scores are floored to whole numbers; 80 passes, 79.9 does not. If nothing usable is heard, no score is shown and nothing counts.
- Capture ends at the first long pause, so say a sentence in one go.
- Providers sit behind interfaces in `src/lib/speech/types.ts`; a different recognizer or scorer can be swapped in without touching the UI. No external provider is implemented.

## Learning data
Per session: card order, position, completed cards. Per scored attempt: card, stage, score, score type, pass/fail, provider and the transcript (capped at 500 characters). Per card: lifetime attempt counts, last scores, a level and next review date (1, 3, 7, 14, 30, 60 days). New and due cards are studied first. Study sessions and attempts are kept until you delete them; deleting a class does not yet remove its sessions.

## Tests
`npm test` runs unit tests (scoring, import, state machine, attempt flow with a mocked recognizer, scheduling).
`npm run test:rules` runs the Firestore rules tests in the emulator (needs Java and downloads the emulator on first run).
Real microphone checks: `docs/MANUAL_TESTING.md`.
