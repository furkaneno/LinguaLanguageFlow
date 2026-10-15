import type { SpeechErrorCode } from "./types";

export function speechErrorMessage(code: SpeechErrorCode): string {
  switch (code) {
    case "permission_denied": return "Microphone access is blocked. Allow it in your browser's site settings, then try again.";
    case "no_microphone": return "No microphone was found. Connect one and try again.";
    case "no_speech": return "We didn't hear anything. Tap the microphone and speak clearly.";
    case "network": return "The speech service couldn't be reached. Check your connection and try again.";
    case "language_unsupported": return "This browser can't recognize that language.";
    case "insecure_context": return "Microphone access needs a secure connection (HTTPS or localhost).";
    case "unsupported": return "This browser doesn't support speech recognition.";
    case "busy": return "Already listening.";
    default: return "Something went wrong with speech recognition. Please try again.";
  }
}
