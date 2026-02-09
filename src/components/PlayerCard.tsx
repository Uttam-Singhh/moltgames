interface PlayerCardProps {
  username: string;
  avatarUrl: string | null;
  eloRating: number;
  score?: number;
  isWinner?: boolean;
  isActive?: boolean;
  eloChange?: number | null;
}

export default function PlayerCard({
  username,
  avatarUrl,
  eloRating,
  score,
  isWinner,
  isActive,
  eloChange,
}: PlayerCardProps) {
  return (
    <div
      className={`flex items-center gap-3 p-4 rounded-none border-2 transition-all duration-300 ${
        isWinner
          ? "border-[var(--success)] bg-[var(--success)]/10 neon-border-green"
          : isActive
          ? "border-[var(--accent)] bg-[var(--accent)]/10 neon-border"
          : "border-[var(--border)] bg-[var(--surface)]"
      }`}
    >
      <div className="flex-shrink-0">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="w-10 h-10 rounded-full" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-[var(--primary)] flex items-center justify-center text-sm font-bold text-white">
            {username[0]?.toUpperCase()}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold truncate">{username}</div>
        <div className="text-sm text-gray-400 font-mono">
          ELO {eloRating}
          {eloChange != null && (
            <span
              className={
                eloChange > 0
                  ? "text-[var(--success)] ml-1 neon-text-green"
                  : "text-[var(--danger)] ml-1 neon-text-red"
              }
            >
              ({eloChange > 0 ? "+" : ""}
              {eloChange})
            </span>
          )}
        </div>
      </div>
      {score != null && (
        <div className="text-3xl font-bold font-mono text-[var(--accent)] neon-text-yellow">{score}</div>
      )}
    </div>
  );
}
