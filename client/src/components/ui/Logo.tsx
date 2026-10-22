export function Logo({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-label="Pulse logo">
      <defs>
        <linearGradient id="pulse-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="rgb(var(--accent))" />
          <stop offset="1" stopColor="rgb(var(--accent2))" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill="url(#pulse-g)" />
      <path d="M14 22a8 8 0 0 1 8-8h20a8 8 0 0 1 8 8v14a8 8 0 0 1-8 8H30l-9 7v-7h-1a6 6 0 0 1-6-6z" fill="#fff" opacity=".95" />
      <path d="M19 31h7l3-7 5 13 3-6h8" fill="none" stroke="url(#pulse-g)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
