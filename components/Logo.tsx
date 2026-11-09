export default function Logo({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="Ghost Ticker emblem">
      <rect x="2" y="2" width="60" height="60" rx="10" fill="#04110b" stroke="#34d399" strokeWidth="3" />
      <circle cx="32" cy="30" r="17" fill="none" stroke="#34d399" strokeOpacity=".35" strokeWidth="2" />
      <circle cx="32" cy="30" r="9" fill="none" stroke="#34d399" strokeOpacity=".6" strokeWidth="2" />
      <path d="M32 30 L46 19" stroke="#34d399" strokeWidth="3" strokeLinecap="round" />
      <circle cx="32" cy="30" r="3" fill="#34d399" />
      <circle cx="41" cy="38" r="2.6" fill="#ef4444" />
      <path d="M10 53 H18 L21 47 L25 57 L29 50 H54" fill="none" stroke="#ef4444" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
