/** Auto-generated docstring. */
export function StatusIcon({ status }: { status: string }) {
  const common = "h-3.5 w-3.5";
  switch (status) {
    case "parsing":
      return (
        <svg viewBox="0 0 16 16" className={common} fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M8 2a6 6 0 1 0 6 6" strokeLinecap="round" />
        </svg>
      );
    case "queued":
      return (
        <svg viewBox="0 0 16 16" className={common} fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 4h10M3 8h10M3 12h6" strokeLinecap="round" />
        </svg>
      );
    case "complete":
      return (
        <svg viewBox="0 0 16 16" className={common} fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3.5 8.5 6.5 11.5 12.5 5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "failed":
      return (
        <svg viewBox="0 0 16 16" className={common} fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M4 4 12 12M12 4 4 12" strokeLinecap="round" />
        </svg>
      );
    case "pending":
      return (
        <svg viewBox="0 0 16 16" className={common} fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="8" cy="8" r="5" />
          <path d="M8 5v3l2 1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 16 16" className={common} fill="currentColor">
          <circle cx="8" cy="8" r="2" />
        </svg>
      );
  }
}
