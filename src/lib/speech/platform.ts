/** True on iPhone, iPad and iPod (including iPadOS, which reports itself as a Mac). Safe to call on the server. */
export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent ?? "";
  const iPadOS = navigator.platform === "MacIntel" && (navigator.maxTouchPoints ?? 0) > 1;
  return /iPad|iPhone|iPod/.test(ua) || iPadOS;
}
