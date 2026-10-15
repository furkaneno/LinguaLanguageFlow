# Manual browser testing (microphone and speech)

Automated tests use a mocked recognizer. These checks need a real browser, microphone and speaker. Use HTTPS or `http://localhost`.

Test on at least: Chrome (desktop), Chrome (Android), Safari (iOS), Edge (desktop). Firefox does not support speech recognition; it should show the "isn't available" screen.

## Setup
1. Create a class with these cards: `I paid the ultimate price for it. | Bedelini ağır ödedim.`, `elevate | yükseltmek`, `draw lessons from setbacks | Aksiliklerden ders çıkarmak`.

## Checks
- [ ] **Permission prompt:** first tap on the microphone shows the browser prompt; the screen explains why beforehand.
- [ ] **Permission denied:** block the mic in site settings, tap the button. A clear "Microphone access is blocked" message appears, the card stays on the same stage, and no score is shown.
- [ ] **Silence:** allow the mic, say nothing. After the timeout you see "We didn't hear anything"; no attempt is counted.
- [ ] **English fail:** say something unrelated. A score below 80% appears with "try again"; Turkish stays locked and the Turkish meaning is never visible.
- [ ] **English pass:** say the sentence. Score is 80%+ and the screen switches to step 2 with the English text still shown.
- [ ] **Turkish fail:** say something wrong. Below 80%, same card, no auto-advance. "Show a hint" reveals the saved meaning but does not pass the card.
- [ ] **Turkish pass:** say the saved meaning. The card completes and the next card appears after about 1.4 seconds, once.
- [ ] **Listen button:** plays the English text. Tapping the mic while it plays stops playback.
- [ ] **Tap to finish:** while recording, tap the button again; capture stops and is scored.
- [ ] **Long sentence:** note whether a mid-sentence pause cuts capture (a known Web Speech limitation).
- [ ] **Single-card class:** after both stages, the completion screen appears.
- [ ] **Refresh mid-session:** reload on card 2 step 2. You return to card 2 step 2 with "Picked up where you left off". "Start over" begins a fresh session.
- [ ] **Second device:** sign in on another device; the active session resumes there.
- [ ] **Offline:** disable the network mid-session; recognition fails with a network message, and a "not saved" notice appears if a write fails.
- [ ] **Screen reader:** the status line announces listening, checking and the result.
- [ ] **Layouts:** 360, 390, 768, 1024 and 1440px wide; no horizontal scroll, mic button comfortable to tap.
