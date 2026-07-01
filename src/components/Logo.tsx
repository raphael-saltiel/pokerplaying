// Emblème néon "Casino Royale" — pique stylisé dans un cadre HUD octogonal.
// Réutilisable (header, hero, intro). SVG pur, aucune dépendance.
export function Logo({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label="Casino Royale"
    >
      <defs>
        <linearGradient id="cr-neon" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#00f0ff" />
          <stop offset="55%" stopColor="#8b5cff" />
          <stop offset="100%" stopColor="#ff00e6" />
        </linearGradient>
        <filter id="cr-glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Cadre octogonal HUD */}
      <path
        d="M30 5 H70 L95 30 V70 L70 95 H30 L5 70 V30 Z"
        fill="rgba(10,4,24,0.6)"
        stroke="url(#cr-neon)"
        strokeWidth="3"
        filter="url(#cr-glow)"
      />
      {/* Accents de coins */}
      <path d="M30 5 H45 M5 30 V45 M70 95 H55 M95 70 V55" stroke="#00f0ff" strokeWidth="2.5" opacity="0.8" />

      {/* Pique */}
      <path
        d="M50 22 C34 40 22 48 22 61 C22 71 30 77 38 73 C41 71.5 43.5 69 45 66 C44 75 41 82 34 86 L66 86 C59 82 56 75 55 66 C56.5 69 59 71.5 62 73 C70 77 78 71 78 61 C78 48 66 40 50 22 Z"
        fill="url(#cr-neon)"
        filter="url(#cr-glow)"
      />
    </svg>
  );
}
