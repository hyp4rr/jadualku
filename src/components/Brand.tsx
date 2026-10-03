import { useId } from "react";

/** App mark: a gold tile with a timetable glyph — three rows of blocks, one highlighted. */
export function LogoMark({ className = "size-8" }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}-g`} x1="4" y1="2" x2="36" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffd77a" />
          <stop offset="0.55" stopColor="#f0b429" />
          <stop offset="1" stopColor="#c47f0a" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="38" height="38" rx="11" fill={`url(#${id}-g)`} />
      <rect x="1.5" y="1.5" width="37" height="37" rx="10.5" fill="none" stroke="#fff" strokeOpacity="0.35" />
      <g fill="#1a1203">
        <rect x="8" y="9" width="10" height="5" rx="2" opacity="0.92" />
        <rect x="21" y="9" width="11" height="5" rx="2" opacity="0.4" />
        <rect x="8" y="17.5" width="14" height="5" rx="2" opacity="0.4" />
        <rect x="25" y="17.5" width="7" height="5" rx="2" opacity="0.92" />
        <rect x="8" y="26" width="7" height="5" rx="2" opacity="0.92" />
        <rect x="18" y="26" width="14" height="5" rx="2" opacity="0.4" />
      </g>
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-extrabold tracking-tight ${className}`}>
      Jadual<span className="text-accent">UiTM</span>Ku
    </span>
  );
}
