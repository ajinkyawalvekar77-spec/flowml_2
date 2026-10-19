export default function FlowMLIcon({ size = 40, className = "" }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="FlowML"
    >
      <defs>
        <linearGradient id="fm-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#C084FC" />
          <stop offset="0.5" stopColor="#7C3AED" />
          <stop offset="1" stopColor="#4C1D95" />
        </linearGradient>
        <radialGradient id="fm-shine" cx="0.25" cy="0.15" r="0.7">
          <stop offset="0" stopColor="#fff" stopOpacity="0.45" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="fm-line" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#EDE9FE" />
          <stop offset="1" stopColor="#fff" />
        </linearGradient>
        <filter id="fm-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <style>{`
        .fm-flow{stroke-dasharray:6 10;animation:fm-dash 1.6s linear infinite}
        .fm-n{transform-box:fill-box;transform-origin:center;animation:fm-pulse 2.4s ease-in-out infinite}
        .fm-n2{animation-delay:.4s}
        .fm-n3{animation-delay:.8s}
        @keyframes fm-dash{to{stroke-dashoffset:-32}}
        @keyframes fm-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.22)}}
        @media (prefers-reduced-motion:reduce){.fm-flow,.fm-n{animation:none}}
      `}</style>
      <g>
        <rect width="64" height="64" rx="18" fill="url(#fm-bg)" />
        <rect width="64" height="64" rx="18" fill="url(#fm-shine)" />
        <rect x=".5" y=".5" width="63" height="63" rx="17.5" fill="none" stroke="#fff" strokeOpacity=".25" />
        <path d="M15 44 C27 44 25 32 32 32 C39 32 37 20 49 20" fill="none" stroke="url(#fm-line)" strokeWidth="4" strokeLinecap="round" opacity=".9" />
        <path className="fm-flow" d="M15 44 C27 44 25 32 32 32 C39 32 37 20 49 20" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" filter="url(#fm-glow)" />
        <g filter="url(#fm-glow)">
          <circle className="fm-n" cx="15" cy="44" r="6" fill="#fff" />
          <circle className="fm-n fm-n2" cx="32" cy="32" r="6" fill="#fff" />
          <circle className="fm-n fm-n3" cx="49" cy="20" r="6.5" fill="#fff" />
        </g>
        <circle cx="15" cy="44" r="2.4" fill="#7C3AED" />
        <circle cx="32" cy="32" r="2.4" fill="#7C3AED" />
        <circle cx="49" cy="20" r="2.8" fill="#C084FC" />
      </g>
    </svg>
  );
}
