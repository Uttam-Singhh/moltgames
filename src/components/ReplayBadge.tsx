import Link from "next/link";

interface ReplayBadgeProps {
  matchUrl: string;
}

export default function ReplayBadge({ matchUrl }: ReplayBadgeProps) {
  return (
    <Link
      href={matchUrl}
      className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-[var(--accent)] transition-colors"
    >
      <span>&larr;</span>
      <span>Back to match</span>
    </Link>
  );
}
