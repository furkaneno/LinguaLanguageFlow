/** A soft cap of snow resting on top of a card. It stays invisible (height 0) outside the Winter theme. */
export function SnowCap() {
  return (
    <svg aria-hidden className="snow-cap" viewBox="0 0 100 20" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="snow-cap-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#D5E6EC" />
        </linearGradient>
      </defs>
      <path d="M0 20 C2 12 6 9 12 11 C16 3 26 3 30 9 C36 5 44 6 48 10 C54 2 66 3 70 9 C76 6 84 8 88 12 C92 8 98 10 100 20 Z" fill="url(#snow-cap-fill)" />
    </svg>
  );
}
