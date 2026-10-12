export function StudentIllustration() {
  return (
    <svg
      viewBox="0 0 420 420"
      role="img"
      aria-label="Illustration of a smiling online learner wearing blue headphones and holding a notebook"
      className="h-full w-full"
    >
      <defs>
        <linearGradient id="shirt" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F98B3C" />
          <stop offset="100%" stopColor="#E9741F" />
        </linearGradient>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#EDE9F9" />
          <stop offset="100%" stopColor="#DCD4F3" />
        </linearGradient>
      </defs>

      <circle cx="210" cy="210" r="200" fill="url(#bg)" />

      {/* shoulders / shirt */}
      <path
        d="M78 420c6-86 58-134 132-134s126 48 132 134z"
        fill="url(#shirt)"
      />
      {/* collar */}
      <path d="M170 292c8 20 24 32 40 32s32-12 40-32c-14-6-26-9-40-9s-26 3-40 9z" fill="#FFF" opacity="0.9" />

      {/* neck */}
      <rect x="192" y="252" width="36" height="44" rx="16" fill="#E8B489" />

      {/* head */}
      <circle cx="210" cy="190" r="78" fill="#F2C69C" />
      {/* hair */}
      <path d="M132 178c-6-52 30-84 78-84s84 32 78 84c-6-26-24-40-78-40s-72 14-78 40z" fill="#2B2B33" />
      <path d="M132 178c-2-14 4-24 10-30 4 16 6 26 6 34z" fill="#2B2B33" />
      <path d="M288 178c2-14-4-24-10-30-4 16-6 26-6 34z" fill="#2B2B33" />

      {/* headphones */}
      <path d="M126 186a84 84 0 0 1 168 0" fill="none" stroke="#2F6FED" strokeWidth="13" strokeLinecap="round" />
      <rect x="110" y="176" width="30" height="56" rx="14" fill="#2F6FED" />
      <rect x="280" y="176" width="30" height="56" rx="14" fill="#2F6FED" />
      <rect x="116" y="184" width="18" height="40" rx="9" fill="#5B90F6" />
      <rect x="286" y="184" width="18" height="40" rx="9" fill="#5B90F6" />

      {/* face */}
      <circle cx="184" cy="188" r="7" fill="#2B2B33" />
      <circle cx="236" cy="188" r="7" fill="#2B2B33" />
      <path d="M186 218c8 10 40 10 48 0" fill="none" stroke="#B5734A" strokeWidth="6" strokeLinecap="round" />
      <circle cx="168" cy="208" r="11" fill="#F0A98A" opacity="0.6" />
      <circle cx="252" cy="208" r="11" fill="#F0A98A" opacity="0.6" />

      {/* notebook */}
      <g transform="rotate(-12 300 350)">
        <rect x="258" y="322" width="104" height="130" rx="10" fill="#FFFFFF" stroke="#D9D2EF" strokeWidth="3" />
        <rect x="258" y="322" width="16" height="130" rx="8" fill="#695BBE" />
        <line x1="292" y1="352" x2="342" y2="352" stroke="#C9C1E6" strokeWidth="6" strokeLinecap="round" />
        <line x1="292" y1="374" x2="342" y2="374" stroke="#C9C1E6" strokeWidth="6" strokeLinecap="round" />
        <line x1="292" y1="396" x2="326" y2="396" stroke="#C9C1E6" strokeWidth="6" strokeLinecap="round" />
      </g>
    </svg>
  );
}
