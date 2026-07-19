/**
 * Small set of flat, on-brand SVG illustrations for empty/status states. Kept in one file
 * since each is only a handful of shapes — reused across dashboard, routines, groups,
 * stats and auth rather than one-off per page.
 */

type IllustrationProps = { className?: string };

export function EmptyRoutinesIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 200 160" className={className} fill="none" role="presentation" aria-hidden="true">
      <ellipse cx="100" cy="142" rx="64" ry="10" fill="#EAF7FC" />
      <rect x="52" y="24" width="96" height="112" rx="16" fill="#FFFFFF" stroke="#A7D8F0" strokeWidth="2" />
      <rect x="76" y="14" width="48" height="20" rx="8" fill="#4FA8D8" />
      <rect x="70" y="54" width="60" height="8" rx="4" fill="#EAF7FC" />
      <rect x="70" y="76" width="44" height="8" rx="4" fill="#EAF7FC" />
      <rect x="70" y="98" width="52" height="8" rx="4" fill="#EAF7FC" />
      <circle cx="66" cy="58" r="6" fill="#78D6B0" />
      <circle cx="66" cy="80" r="6" fill="#EAF7FC" stroke="#A7D8F0" strokeWidth="1.5" />
      <circle cx="66" cy="102" r="6" fill="#EAF7FC" stroke="#A7D8F0" strokeWidth="1.5" />
      <path d="M148 40l4 8 8 4-8 4-4 8-4-8-8-4 8-4 4-8z" fill="#FFD166" />
    </svg>
  );
}

export function EmptyGroupsIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 200 160" className={className} fill="none" role="presentation" aria-hidden="true">
      <ellipse cx="100" cy="140" rx="66" ry="10" fill="#EAF7FC" />
      <circle cx="76" cy="76" r="30" fill="#EAF7FC" stroke="#A7D8F0" strokeWidth="2" />
      <circle cx="76" cy="64" r="11" fill="#A7D8F0" />
      <path d="M54 100c2-14 12-22 22-22s20 8 22 22" stroke="#A7D8F0" strokeWidth="2" fill="#FFFFFF" />
      <circle cx="132" cy="88" r="24" fill="#FFFFFF" stroke="#78D6B0" strokeWidth="2" />
      <circle cx="132" cy="78" r="9" fill="#78D6B0" />
      <path d="M114 106c2-11 9-17 18-17s16 6 18 17" stroke="#78D6B0" strokeWidth="2" fill="#FFFFFF" />
      <circle cx="150" cy="46" r="14" fill="#4FA8D8" />
      <path d="M150 40v12M144 46h12" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function EmptyStatsIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 200 160" className={className} fill="none" role="presentation" aria-hidden="true">
      <ellipse cx="100" cy="142" rx="64" ry="9" fill="#EAF7FC" />
      <rect x="40" y="30" width="120" height="96" rx="14" fill="#FFFFFF" stroke="#A7D8F0" strokeWidth="2" />
      <rect x="60" y="88" width="14" height="24" rx="4" fill="#A7D8F0" />
      <rect x="84" y="72" width="14" height="40" rx="4" fill="#4FA8D8" />
      <rect x="108" y="56" width="14" height="56" rx="4" fill="#78D6B0" />
      <rect x="132" y="80" width="14" height="32" rx="4" fill="#FFD166" />
      <path d="M58 66l20-14 16 10 26-22" stroke="#4FA8D8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="120" cy="40" r="4" fill="#4FA8D8" />
    </svg>
  );
}

export function WelcomeIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 200 160" className={className} fill="none" role="presentation" aria-hidden="true">
      <ellipse cx="100" cy="140" rx="60" ry="9" fill="#EAF7FC" />
      <circle cx="100" cy="82" r="52" fill="#EAF7FC" />
      <rect x="72" y="56" width="56" height="56" rx="18" fill="#4FA8D8" />
      <path d="M100 72l6 12 13 2-9.5 9 2 13-11.5-6-11.5 6 2-13-9.5-9 13-2 6-12z" fill="#FFFFFF" />
      <path d="M46 50l3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7z" fill="#FFD166" />
      <path d="M154 96l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5 2.5-6z" fill="#78D6B0" />
    </svg>
  );
}

export function SuccessIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 200 160" className={className} fill="none" role="presentation" aria-hidden="true">
      <ellipse cx="100" cy="140" rx="58" ry="9" fill="#EAF7FC" />
      <g stroke="#FFD166" strokeWidth="3" strokeLinecap="round">
        <path d="M100 20v10" />
        <path d="M100 130v10" />
        <path d="M40 78h10" />
        <path d="M150 78h10" />
        <path d="M58 36l7 7" />
        <path d="M135 121l7 7" />
        <path d="M142 36l-7 7" />
        <path d="M65 121l-7 7" />
      </g>
      <circle cx="100" cy="78" r="42" fill="#78D6B0" />
      <path d="M80 79l14 14 26-28" stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function OfflineIllustration({ className }: IllustrationProps) {
  return (
    <svg viewBox="0 0 200 160" className={className} fill="none" role="presentation" aria-hidden="true">
      <ellipse cx="100" cy="130" rx="58" ry="9" fill="#EAF7FC" />
      <path
        d="M60 96c-13 0-22-10-22-22 0-11 8-20 19-22 3-15 17-26 33-26 17 0 31 12 34 28 11 1 20 11 20 22 0 13-10 22-23 22H60z"
        fill="#FFFFFF"
        stroke="#A7D8F0"
        strokeWidth="2"
      />
      <path d="M54 116l92-56" stroke="#FF8A80" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
