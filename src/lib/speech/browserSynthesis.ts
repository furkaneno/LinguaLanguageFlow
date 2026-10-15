import type { SpeechSynthesisProvider } from "./types";

const synth = (): SpeechSynthesis | undefined => (typeof window !== "undefined" ? window.speechSynthesis : undefined);

export class BrowserSynthesisProvider implements SpeechSynthesisProvider {
  isSupported() { return !!synth() && typeof SpeechSynthesisUtterance !== "undefined"; }

  hasVoiceFor(lang: string): boolean | null {
    const voices = synth()?.getVoices() ?? [];
    if (voices.length === 0) return null; // some browsers load voices lazily
    const base = lang.slice(0, 2).toLowerCase();
    return voices.some((v) => v.lang.toLowerCase().startsWith(base));
  }

  speak(text: string, lang: string): Promise<"spoken" | "error"> {
    const s = synth();
    if (!s) return Promise.resolve("error");
    s.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang; u.rate = 0.9;
    const voices = s.getVoices();
    const base = lang.slice(0, 2).toLowerCase();
    const voice = voices.find((v) => v.lang === lang) ?? voices.find((v) => v.lang.toLowerCase().startsWith(base));
    if (voice) u.voice = voice;
    return new Promise((resolve) => {
      u.onend = () => resolve("spoken");
      u.onerror = () => resolve("error");
      s.speak(u);
    });
  }

  cancel() { synth()?.cancel(); }
}
