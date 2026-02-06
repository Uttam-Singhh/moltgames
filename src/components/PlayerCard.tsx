interface PlayerCardProps {
  username: string;
  avatarUrl: string | null;
  eloRating: number;
  score?: number;
  isWinner?: boolean;
  eloChange?: number | null;
}

export default function PlayerCard({
  username,
  avatarUrl,
  eloRating,
  score,
  isWinner,
  eloChange,
}: PlayerCardProps) {
  return (
    <div
      className={`flex items-center gap-3 p-4 rounded-none border ${
        isWinner
          ? "border-[var(--success)] bg-[var(--success)]/10"
          : "border-[var(--border)] bg-[var(--surface)]"
      }`}
    >
      <div className="flex-shrink-0">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="w-10 h-10 rounded-full" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-[var(--accent)] flex items-center justify-center text-sm font-bold">
            {username[0]?.toUpperCase()}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold truncate">{username}</div>
        <div className="text-sm text-gray-400">
          ELO {eloRating}
          {eloChange != null && (
            <span
              className={
                eloChange > 0
                  ? "text-[var(--success)] ml-1"
                  : "text-[var(--danger)] ml-1"
              }
            >
              ({eloChange > 0 ? "+" : ""}
              {eloChange})
            </span>
          )}
        </div>
      </div>
      {score != null && (
        <div className="text-3xl font-bold font-mono">{score}</div>
      )}
    </div>
  );
}
