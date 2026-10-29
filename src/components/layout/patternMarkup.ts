/**
 * Retro travel-sticker background: one line-art landmark per country, drawn in a 100x100 box in currentColor.
 * Used only by the Retro Brown theme. Add a landmark by adding an entry to ICONS and a slot in LAYOUT.
 */
const ICONS: Record<string, string> = {
  // France
  eiffel: `<path d="M50 4Q48 52 30 94M50 4Q52 52 70 94M50 4V0M44 38h12M39 62h22M44 38L61 62M56 38L39 62M34 94Q50 68 66 94M24 94h52"/>`,
  // Egypt
  pyramids: `<path d="M6 92L44 26L82 92ZM62 92L82 58L98 92M26 62h36M16 78h56"/><circle cx="80" cy="22" r="8"/>`,
  // USA
  liberty: `<path d="M32 94V78H68V94M36 78l4-32h20l4 32M43 26l-5-7M50 24v-9M57 26l5-7M58 48L70 30L72 16M68 18h8M72 16q-5-6 0-13q5 7 0 13M24 94h52"/><circle cx="50" cy="32" r="7"/>`,
  // India
  taj: `<path d="M34 58Q32 34 50 22Q68 34 66 58M50 22V10M30 58H70V88H30ZM44 88V74Q50 64 56 74V88M12 88V40M8 40h8M12 40v-8M88 88V40M84 40h8M88 40v-8M4 88H96"/>`,
  // United Kingdom
  bigben: `<path d="M38 94V32H62V94M36 32L50 10L64 32ZM50 10V3M50 43v5l4 3M44 66v14M56 66v14M32 94h36"/><circle cx="50" cy="48" r="9"/>`,
  // Italy
  colosseum: `<path d="M6 40Q50 26 94 40V80Q50 94 6 80ZM6 40Q50 54 94 40M18 70v-8a4 4 0 0 1 8 0v8M34 74v-8a4 4 0 0 1 8 0v8M46 76v-8a4 4 0 0 1 8 0v8M58 74v-8a4 4 0 0 1 8 0v8M74 70v-8a4 4 0 0 1 8 0v8"/>`,
  // China
  wall: `<path d="M4 76L34 52L62 64L96 34M4 90L34 66L62 78L96 48M4 76v14M96 34v14M34 52v14M62 64v14M26 58V38H42V52M54 66V46H70V58"/>`,
  // Australia
  opera: `<path d="M8 86Q12 46 46 30Q42 60 46 86ZM46 86Q50 44 80 26Q76 58 78 86ZM62 86Q66 64 92 56Q90 72 92 86ZM4 90H96M12 94h76"/>`,
  // Brazil
  christ: `<path d="M12 42L50 32L88 42M42 32L40 76H60L58 32M34 76V86H66V76M6 94Q50 78 94 94"/><circle cx="50" cy="17" r="6"/>`,
  // Japan
  fuji: `<path d="M4 92L36 32H64L96 92ZM36 32l7 10 7-8 7 8 7-10"/><circle cx="82" cy="20" r="8"/>`,
  // Turkiye (Galata Tower)
  galata: `<path d="M38 94V46L32 38H68L62 46V94M32 38L50 14L68 38M50 14V4M50 56v8M50 74v8M30 94h40"/>`,
  // Mexico (Chichen Itza)
  chichen: `<path d="M6 92H94V82H86V72H78V62H68V52H32V62H22V72H14V82H6ZM40 52V38H60V52M46 38V30H54V38M44 92V52M56 92V52"/>`,
  // Chile (Easter Island)
  moai: `<path d="M32 94V44Q30 14 50 10Q70 14 68 44V94ZM36 38H64M50 38V58L56 63H44L50 58M42 74H58M38 36q4-4 8 0M54 36q4-4 8 0"/>`,
  // Netherlands
  windmill: `<path d="M36 94L42 46H58L64 94ZM38 46L50 34L62 46M50 40L20 12M50 40L80 68M50 40L80 12M50 40L20 68M46 94V84a4 4 0 0 1 8 0V94"/>`,
  // Greece
  parthenon: `<path d="M8 40L50 16L92 40ZM8 40H92V46H8ZM18 46V84M31 46V84M44 46V84M56 46V84M69 46V84M82 46V84M6 84H94V92H6Z"/>`,
  // United Arab Emirates
  burj: `<path d="M50 2L52 22L56 30V46L61 58V74L66 92H34L39 74V58L44 46V30L48 22ZM50 22V92M44 46h12M39 74h22"/>`,
  // Russia
  basil: `<path d="M38 62C30 50 44 44 50 30C56 44 70 50 62 62ZM50 30V20M46 22h8M18 74C12 66 22 62 26 52C30 62 40 66 34 74ZM26 52V46M66 74C60 66 70 62 74 52C78 62 88 66 82 74ZM74 52V46M40 74V62M60 74V62M14 94V74H86V94M44 94V84a6 6 0 0 1 12 0V94"/>`,
  // travel details
  plane: `<path d="M6 82Q40 22 84 30" stroke-dasharray="2 7"/><path d="M96 26L64 18L74 34ZM74 34L72 46L82 38"/>`,
  stamp: `<circle cx="50" cy="50" r="36"/><circle cx="50" cy="50" r="28" stroke-dasharray="3 5"/><path d="M50 32l5 12 13 1-10 8 3 13-11-7-11 7 3-13-10-8 13-1Z"/>`,
  compass: `<path d="M50 6L56 44L94 50L56 56L50 94L44 56L6 50L44 44Z"/><circle cx="50" cy="50" r="5"/>`,
};

// Rows alternate between two horizontal offsets so the repeat feels scattered, not gridded.
const LAYOUT: string[][] = [
  ["eiffel", "pyramids", "liberty", "taj", "bigben"],
  ["colosseum", "wall", "opera", "christ", "fuji"],
  ["galata", "chichen", "moai", "windmill", "parthenon"],
  ["burj", "plane", "basil", "stamp", "compass"],
];

export const PATTERN_WIDTH = 700;
export const PATTERN_HEIGHT = 560;
const PITCH = 140;
const SIZE = 100;

const place = (id: string, x: number, y: number) => `<g transform="translate(${x} ${y})">${ICONS[id] ?? ""}</g>`;

function buildTile(): string {
  const out: string[] = [];
  LAYOUT.forEach((row, r) => {
    const y = 20 + r * PITCH;
    const x0 = r % 2 === 0 ? 10 : 80;
    row.forEach((id, k) => {
      const x = x0 + k * PITCH;
      out.push(place(id, x, y));
      if (x + SIZE > PATTERN_WIDTH) out.push(place(id, x - PATTERN_WIDTH, y)); // wrap so neighbouring tiles join seamlessly
    });
  });
  return `<g fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${out.join("")}</g>`;
}

export const PATTERN_TILE = buildTile();
export const LANDMARK_COUNT = Object.keys(ICONS).length;
