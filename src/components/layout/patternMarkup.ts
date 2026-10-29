/**
 * Cute minimalist animal background for the Retro Brown theme.
 * Every animal is line art in a 100x100 box, drawn in currentColor. Add one by adding an entry to ANIMALS and a slot in LAYOUT.
 */
const eye = (x: number, y: number) => `<circle cx="${x}" cy="${y}" r="1.8" fill="currentColor"/>`;
const eyes = (y: number, d = 11) => eye(50 - d, y) + eye(50 + d, y);
const nose = (x: number, y: number) => `<path d="M${x - 3.5} ${y}h7l-3.5 4z" fill="currentColor"/>`;
const mouth = (x: number, y: number) => `<path d="M${x} ${y}v3M${x} ${y + 3}q-4 4-8 0M${x} ${y + 3}q4 4 8 0"/>`;
const ring = (cx: number, cy: number, R: number, n: number, r: number) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * 2 * Math.PI;
    return `<circle cx="${(cx + R * Math.cos(a)).toFixed(1)}" cy="${(cy + R * Math.sin(a)).toFixed(1)}" r="${r}"/>`;
  }).join("");
/** Fills a shape with the page colour so shapes drawn earlier don't show through it. */
const BG = `style="fill:rgb(var(--c-bg))"`;
/** Overlapping circles drawn as one fluffy outline (inner crossing lines are painted over). */
const cloud = (cx: number, cy: number, R: number, n: number, r: number) =>
  ring(cx, cy, R, n, r) + ring(cx, cy, R, n, r - 1.3).replaceAll("/>", ` ${BG} stroke="none"/>`);

const octopusLegs = [30, 40, 50, 60, 70]
  .map((x, i) => {
    const y0 = (36 + Math.sqrt(26 * 26 - (x - 50) ** 2)).toFixed(1);
    return `<path d="M${x} ${y0}q${i % 2 ? 8 : -8} 10 0 18t0 16"/>`;
  })
  .join("");

const ANIMALS: Record<string, string> = {
  cat: `<ellipse cx="50" cy="58" rx="30" ry="26"/><path d="M24 44L22 14L44 33M76 44L78 14L56 33"/>${eyes(54, 12)}${nose(50, 62)}${mouth(50, 66)}<path d="M12 62h14M14 70l12-3M88 62H74M86 70l-12-3"/>`,
  dog: `<path d="M28 36Q8 36 12 68Q26 68 28 52M72 36Q92 36 88 68Q74 68 72 52"/><ellipse cx="50" cy="52" rx="24" ry="26" ${BG}/><ellipse cx="50" cy="66" rx="13" ry="10"/><ellipse cx="50" cy="61" rx="4.5" ry="3" fill="currentColor"/>${eyes(46, 10)}<path d="M50 64v5M50 69q-5 4-9 0M50 69q5 4 9 0"/>`,
  rabbit: `<ellipse cx="38" cy="24" rx="8" ry="20"/><ellipse cx="62" cy="24" rx="8" ry="20"/><circle cx="50" cy="66" r="24" ${BG}/>${eyes(62, 10)}${nose(50, 68)}<path d="M50 72q-4 4-8 2M50 72q4 4 8 2"/>`,
  bear: `<circle cx="25" cy="30" r="10"/><circle cx="75" cy="30" r="10"/><circle cx="25" cy="30" r="4"/><circle cx="75" cy="30" r="4"/><circle cx="50" cy="56" r="30" ${BG}/><ellipse cx="50" cy="68" rx="13" ry="10"/>${eyes(50, 13)}<ellipse cx="50" cy="63" rx="4.5" ry="3" fill="currentColor"/><path d="M50 66v4M50 70q-5 4-9 0M50 70q5 4 9 0"/>`,
  panda: `<circle cx="25" cy="32" r="10" fill="currentColor"/><circle cx="75" cy="32" r="10" fill="currentColor"/><circle cx="50" cy="58" r="30" ${BG}/><ellipse cx="37" cy="52" rx="8" ry="10" transform="rotate(20 37 52)"/><ellipse cx="63" cy="52" rx="8" ry="10" transform="rotate(-20 63 52)"/>${eye(38, 53)}${eye(62, 53)}<ellipse cx="50" cy="66" rx="5.5" ry="3.8" fill="currentColor"/><path d="M50 70q-5 5-10 1M50 70q5 5 10 1"/>`,
  fox: `<path d="M12 22L36 38Q50 34 64 38L88 22L84 62Q50 96 16 62Z"/>${eyes(52, 14)}<ellipse cx="50" cy="78" rx="4.5" ry="3" fill="currentColor"/><path d="M20 34l8 6M80 34l-8 6M28 66Q40 62 50 70Q60 62 72 66"/>`,
  elephant: `<path d="M30 34Q2 30 6 62Q12 82 32 68M70 34Q98 30 94 62Q88 82 68 68"/><ellipse cx="50" cy="48" rx="22" ry="24" ${BG}/><path d="M42 62Q36 84 46 92Q56 94 56 84Q56 76 58 62" ${BG}/>${eyes(42, 9)}<path d="M46 76h8"/>`,
  giraffe: `<path d="M42 18V8M58 18V8M38 58L32 94M62 58L68 94"/><circle cx="42" cy="6" r="2.5"/><circle cx="58" cy="6" r="2.5"/><ellipse cx="22" cy="34" rx="9" ry="5" transform="rotate(-25 22 34)"/><ellipse cx="78" cy="34" rx="9" ry="5" transform="rotate(25 78 34)"/><ellipse cx="50" cy="36" rx="20" ry="22" ${BG}/><ellipse cx="50" cy="50" rx="11" ry="8"/>${eye(46, 50)}${eye(54, 50)}${eyes(34, 9)}<circle cx="46" cy="76" r="4"/><circle cx="57" cy="68" r="3.5"/><circle cx="52" cy="88" r="4"/>`,
  lion: `${ring(50, 52, 32, 12, 9)}<circle cx="50" cy="52" r="24" ${BG}/>${eyes(48, 10)}${nose(50, 55)}${mouth(50, 60)}`,
  monkey: `<circle cx="20" cy="52" r="10"/><circle cx="80" cy="52" r="10"/><circle cx="20" cy="52" r="4.5"/><circle cx="80" cy="52" r="4.5"/><circle cx="50" cy="50" r="30" ${BG}/><path d="M50 42Q34 34 30 50Q30 72 50 78Q70 72 70 50Q66 34 50 42Z"/>${eyes(54, 8)}${eye(47, 65)}${eye(53, 65)}<path d="M42 70q8 6 16 0"/>`,
  pig: `<path d="M24 38L16 14L42 26M76 38L84 14L58 26"/><circle cx="50" cy="56" r="30" ${BG}/>${eyes(48, 13)}<ellipse cx="50" cy="66" rx="14" ry="10"/><circle cx="45" cy="66" r="1.9" fill="currentColor"/><circle cx="55" cy="66" r="1.9" fill="currentColor"/>`,
  cow: `<path d="M30 32Q18 20 24 10M70 32Q82 20 76 10"/><ellipse cx="16" cy="44" rx="10" ry="5.5" transform="rotate(-20 16 44)"/><ellipse cx="84" cy="44" rx="10" ry="5.5" transform="rotate(20 84 44)"/><ellipse cx="50" cy="56" rx="24" ry="28" ${BG}/><ellipse cx="50" cy="73" rx="16" ry="11"/>${eye(44, 73)}${eye(56, 73)}${eyes(50, 11)}<path d="M44 30Q50 24 58 30Q56 40 46 40Q42 36 44 30Z"/>`,
  sheep: `${cloud(50, 44, 22, 9, 13)}<ellipse cx="32" cy="58" rx="9" ry="4.5" transform="rotate(25 32 58)" ${BG}/><ellipse cx="68" cy="58" rx="9" ry="4.5" transform="rotate(-25 68 58)" ${BG}/><ellipse cx="50" cy="64" rx="14" ry="18" ${BG}/>${eyes(58, 7)}<path d="M50 64v3M50 67q-3 3-6 0M50 67q3 3 6 0"/>`,
  penguin: `<path d="M24 52Q10 64 20 76M76 52Q90 64 80 76M38 94h10M52 94h10"/><ellipse cx="50" cy="56" rx="26" ry="36" ${BG}/><ellipse cx="50" cy="66" rx="16" ry="24"/>${eyes(34, 9)}<path d="M44 40h12l-6 8z" fill="currentColor"/>`,
  owl: `<path d="M26 34L22 12L42 26M74 34L78 12L58 26"/><ellipse cx="50" cy="58" rx="30" ry="34" ${BG}/><circle cx="38" cy="46" r="10"/><circle cx="62" cy="46" r="10"/>${eye(38, 46)}${eye(62, 46)}<path d="M46 54h8l-4 8z" fill="currentColor"/><path d="M40 72l4 4 4-4M52 72l4 4 4-4M46 82l4 4 4-4M40 94h8M52 94h8"/>`,
  duck: `<path d="M16 58L6 46L24 52"/><ellipse cx="44" cy="66" rx="30" ry="20" ${BG}/><circle cx="70" cy="36" r="16" ${BG}/><path d="M84 34L98 38L84 42Z"/>${eye(74, 32)}<path d="M28 64Q44 78 60 64M4 92q5-5 10 0t10 0t10 0t10 0t10 0t10 0t10 0t10 0"/>`,
  fish: `<path d="M72 50L96 32V68Z"/><ellipse cx="44" cy="50" rx="30" ry="20" ${BG}/>${eye(28, 44)}<path d="M16 52q4 3 8 0M42 32Q50 18 60 32M44 44q5 6 0 12M54 44q5 6 0 12"/><circle cx="12" cy="28" r="3"/><circle cx="20" cy="16" r="2"/>`,
  whale: `<path d="M6 66Q8 34 44 34Q76 34 86 58L98 46L96 72L84 66Q74 84 44 82Q10 82 6 66Z"/>${eye(22, 58)}<path d="M10 68q8 5 16 0M30 34V22M30 22Q22 14 18 20M30 22Q38 14 42 20M30 72q14 6 28 0"/>`,
  octopus: `${octopusLegs}<circle cx="50" cy="36" r="26" ${BG}/>${eyes(34, 9)}<path d="M44 44q6 5 12 0"/><circle cx="34" cy="22" r="2"/><circle cx="66" cy="22" r="2"/>`,
  turtle: `<circle cx="12" cy="58" r="9"/>${eye(9, 56)}<path d="M26 64v14h12V64M62 64v14h12V64M84 64l10 6"/><path d="M16 64Q16 22 50 22Q84 22 84 64Z" ${BG}/><path d="M43 38h14l7 12-7 12H43l-7-12zM43 38L32 28M57 38L68 28M64 50L82 50M36 50L18 50M57 62L68 64M43 62L32 64"/>`,
  frog: `<circle cx="32" cy="34" r="11"/><circle cx="68" cy="34" r="11"/><ellipse cx="50" cy="60" rx="36" ry="24" ${BG}/>${eye(32, 33)}${eye(68, 33)}${eye(45, 52)}${eye(55, 52)}<path d="M22 62q28 22 56 0"/>`,
  butterfly: `<path d="M50 30V74M50 30Q44 18 38 16M50 30Q56 18 62 16M50 40Q20 8 10 34Q8 54 50 52M50 40Q80 8 90 34Q92 54 50 52M50 54Q18 56 24 78Q34 90 50 70M50 54Q82 56 76 78Q66 90 50 70"/><circle cx="28" cy="34" r="4"/><circle cx="72" cy="34" r="4"/><circle cx="34" cy="72" r="3"/><circle cx="66" cy="72" r="3"/>`,
  bee: `<ellipse cx="42" cy="30" rx="9" ry="15" transform="rotate(-20 42 30)"/><ellipse cx="60" cy="30" rx="9" ry="15" transform="rotate(20 60 30)"/><ellipse cx="52" cy="58" rx="26" ry="20" ${BG}/><path d="M46 40V76M60 40V76M78 58l10 2M20 48Q16 38 8 36M28 48Q30 38 36 34"/><circle cx="24" cy="58" r="11" ${BG}/>${eye(20, 56)}<path d="M18 62q3 3 6 0"/>`,
  snail: `<circle cx="62" cy="48" r="26"/><circle cx="64" cy="48" r="16"/><circle cx="65" cy="48" r="7"/><path d="M24 78Q22 90 34 90H84Q94 90 92 80M16 56L12 42M24 56L28 44"/><circle cx="20" cy="68" r="12" ${BG}/>${eye(17, 66)}<path d="M15 72q4 3 8 0"/><circle cx="12" cy="40" r="2.5"/><circle cx="28" cy="42" r="2.5"/>`,
  hedgehog: `<path d="M14 78Q12 34 54 30Q92 32 92 78Z"/><path d="M26 44l-6-6M38 34l-3-8M52 30v-9M66 32l3-9M80 40l6-8M90 54l8-4M30 78v8M70 78v8"/><path d="M16 78L4 72L14 62Z"/>${eye(4, 72)}${eye(18, 68)}`,
};

// Rows alternate between two horizontal offsets so the repeat feels scattered, not gridded.
const LAYOUT: string[][] = [
  ["cat", "rabbit", "owl", "fish", "elephant"],
  ["bear", "butterfly", "pig", "turtle", "fox"],
  ["duck", "panda", "snail", "lion", "bee"],
  ["frog", "dog", "penguin", "octopus", "sheep"],
  ["hedgehog", "giraffe", "whale", "monkey", "cow"],
];

export const PATTERN_WIDTH = 700;
export const PATTERN_HEIGHT = 700;
const PITCH = 140;
const SIZE = 100;

const place = (id: string, x: number, y: number) => `<g transform="translate(${x} ${y})">${ANIMALS[id] ?? ""}</g>`;

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
export const ANIMAL_COUNT = Object.keys(ANIMALS).length;
