"use client";

interface TttMove {
  position: number;
  symbol: string;
  move_number: number;
  player_id: string;
  reasoning: string | null;
  created_at: string;
}

interface TttMoveHistoryProps {
  moves: TttMove[];
  player1: { id: string; username: string };
  player2: { id: string; username: string };
}

export default function TttMoveHistory({
  moves,
  player1,
  player2,
}: TttMoveHistoryProps) {
  if (moves.length === 0) {
    return (
      <div className="text-center text-gray-500 py-4 text-sm">
        No moves yet
      </div>
    );
  }

  const getPlayerName = (playerId: string) =>
    playerId === player1.id ? player1.username : player2.username;

  const positionLabel = (pos: number) => {
    const row = Math.floor(pos / 3);
    const col = pos % 3;
    const rows = ["top", "middle", "bottom"];
    const cols = ["left", "center", "right"];
    return `${rows[row]}-${cols[col]}`;
  };

  return (
    <div className="space-y-2">
      {moves.map((move) => (
        <div
          key={move.move_number}
          className="flex items-start gap-3 p-2 bg-[var(--surface)] border border-[var(--border)] text-sm"
        >
          <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-[var(--background)] text-xs font-mono text-gray-500">
            {move.move_number}
          </div>
          <div className="flex-1 min-w-0">
            <div>
              <span
                className={
                  move.symbol === "X"
                    ? "text-[var(--accent-light)] font-semibold"
                    : "text-[var(--warning)] font-semibold"
                }
              >
                {move.symbol}
              </span>
              <span className="text-gray-400 mx-1">-</span>
              <span className="font-medium">
                {getPlayerName(move.player_id)}
              </span>
              <span className="text-gray-500 ml-2">
                pos {move.position} ({positionLabel(move.position)})
              </span>
            </div>
            {move.reasoning && (
              <div className="text-gray-500 text-xs mt-1 truncate">
                {move.reasoning}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
