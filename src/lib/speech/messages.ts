import type { SpeechErrorCode } from "./types";

const IOS_SETUP =
  " On iPhone, also turn on Dictation (Settings → General → Keyboard → Enable Dictation) and allow the microphone for Safari (Settings → Safari → Microphone).";

export function speechErrorMessage(code: SpeechErrorCode, ios = false): string {
  switch (code) {
    case "permission_denied": return `Microphone access is blocked. Allow it in your browser's site settings, then try again.${ios ? IOS_SETUP : ""}`;
    case "no_microphone": return "No microphone was found. Connect one and try again.";
    case "no_speech": return `We didn't hear anything. Tap the microphone and speak clearly.${ios ? " On iPhone, hold the phone close and make sure Dictation is on (Settings → General → Keyboard)." : ""}`;
    case "network": return "The speech service couldn't be reached. Check your connection and try again.";
    case "language_unsupported": return "This browser can't recognize that language.";
    case "insecure_context": return "Microphone access needs a secure connection (HTTPS or localhost).";
    case "unsupported": return `This browser doesn't support speech recognition.${ios ? " On iPhone, open the site in Safari." : ""}`;
    case "busy": return "Already listening.";
    case "service_error": return "The speech service had a problem. Please try again in a moment.";
    case "rate_limited": return "Too many recordings in a short time. Wait a few seconds and try again.";
    default: return "Something went wrong with speech recognition. Please try again.";
  }
}
