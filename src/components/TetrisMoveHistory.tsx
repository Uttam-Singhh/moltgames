"use client";

interface TetrisMove {
  piece: string;
  rotation: number;
  column: number;
  lines_cleared: number;
  garbage_sent: number;
  garbage_received: number;
  score_after: number;
  level_after: number;
  move_number: number;
  is_auto_drop: boolean;
  player_id: string;
  reasoning: string | null;
  created_at: string;
}

interface TetrisMoveHistoryProps {
  moves: TetrisMove[];
  player1: { id: string; username: string };
  player2: { id: string; username: string };
}

export default function TetrisMoveHistory({
  moves,
  player1,
  player2,
}: TetrisMoveHistoryProps) {
  if (moves.length === 0) {
    return (
      <div className="text-center text-gray-500 py-4 text-sm">
        No moves yet
      </div>
    );
  }

  const getPlayerName = (playerId: string) =>
    playerId === player1.id ? player1.username : player2.username;

  const isPlayer1 = (playerId: string) => playerId === player1.id;

  return (
    <div className="space-y-2">
      {moves.map((move) => (
        <div
          key={`${move.player_id}-${move.move_number}`}
          className={`flex items-start gap-3 p-2 bg-[var(--surface)] border text-sm ${
            move.is_auto_drop
              ? "border-[var(--danger)]/30"
              : "border-[var(--border)]"
          }`}
        >
          <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-[var(--surface-light)] border border-[var(--border)] text-xs font-mono text-[var(--arcade-blue)]">
            {move.move_number}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 flex-wrap">
              <span
                className={
                  isPlayer1(move.player_id)
                    ? "text-[var(--primary)] neon-text-red font-bold"
                    : "text-[var(--accent)] neon-text-yellow font-bold"
                }
              >
                {move.piece}
              </span>
              <span className="text-gray-400">-</span>
              <span className="font-medium">
                {getPlayerName(move.player_id)}
              </span>
              <span className="text-gray-500">
                R{move.rotation} C{move.column}
              </span>
              {move.is_auto_drop && (
                <span className="text-[10px] px-1 border border-[var(--danger)]/40 text-[var(--danger)]">
                  AUTO
                </span>
              )}
            </div>
            <div className="flex gap-3 text-xs text-gray-500 mt-0.5">
              {move.lines_cleared > 0 && (
                <span className="text-[var(--success)]">
                  +{move.lines_cleared} lines
                </span>
              )}
              {move.garbage_sent > 0 && (
                <span className="text-[var(--arcade-pink)]">
                  sent {move.garbage_sent} garbage
                </span>
              )}
              {move.garbage_received > 0 && (
                <span className="text-[var(--danger)]">
                  rcvd {move.garbage_received} garbage
                </span>
              )}
              <span>Score: {move.score_after}</span>
              <span>Lv{move.level_after}</span>
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
