/**
 * One tile of the background pattern: minimalist English-learning motifs
 * (letters, a speech bubble, quote marks, a sound wave, a microphone, punctuation, the "th" sound).
 * Drawn in currentColor so every theme can tint it.
 */
export const PATTERN_TILE = `
<g fill="currentColor" stroke="none" font-family="'Fraunces Variable', Georgia, 'Times New Roman', serif">
  <text x="34" y="86" font-size="46">Aa</text>
  <text x="46" y="262" font-size="86">&#8220;</text>
  <text x="128" y="334" font-size="30" letter-spacing="5">abc</text>
  <text x="318" y="366" font-size="46" transform="rotate(8 330 350)">?!</text>
  <text x="150" y="132" font-size="36" font-style="italic">&amp;</text>
  <text x="232" y="318" font-size="44" transform="rotate(-6 250 300)">&#952;</text>
  <circle cx="260" cy="71" r="3"/><circle cx="282" cy="71" r="3"/><circle cx="304" cy="71" r="3"/>
</g>
<g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
  <path transform="rotate(-6 282 80)" d="M246 40H318a14 14 0 0 1 14 14V88a14 14 0 0 1-14 14H274L256 120V102H246a14 14 0 0 1-14-14V54a14 14 0 0 1 14-14Z"/>
  <path d="M200 182v16M212 172v36M224 160v60M236 176v28M248 164v52M260 180v20M272 170v40"/>
  <g transform="rotate(8 330 236)">
    <rect x="322" y="206" width="16" height="30" rx="8"/>
    <path d="M314 232a16 16 0 0 0 32 0M330 248v14M320 262h20"/>
  </g>
  <path d="M36 386q9-10 18 0t18 0t18 0t18 0"/>
  <path d="M176 40v12M170 46h12M372 170v10M367 175h10M92 300v10M87 305h10"/>
  <circle cx="150" cy="40" r="4"/><circle cx="384" cy="300" r="4"/><circle cx="96" cy="176" r="3"/>
</g>`;
