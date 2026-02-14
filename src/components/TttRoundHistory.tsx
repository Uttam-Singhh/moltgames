"use client";

interface TttRound {
  round_number: number;
  board: string;
  move_count: number;
  winner_id: string | null;
  is_draw: boolean;
}

interface TttRoundHistoryProps {
  rounds: TttRound[];
  player1: { id: string; username: string };
  player2: { id: string; username: string };
  selectedRound: number | null;
  onSelectRound: (roundNumber: number | null) => void;
}

export default function TttRoundHistory({
  rounds,
  player1,
  player2,
  selectedRound,
  onSelectRound,
}: TttRoundHistoryProps) {
  const completedRounds = rounds.filter(
    (r) => r.winner_id !== null || r.is_draw
  );

  if (completedRounds.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500 text-sm">
        No rounds completed yet.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {completedRounds.map((round) => {
        const isSelected = selectedRound === round.round_number;
        const winnerName = round.is_draw
          ? "Draw"
          : round.winner_id === player1.id
          ? player1.username
          : player2.username;
        const isP1Winner = round.winner_id === player1.id;
        const isP2Winner = round.winner_id === player2.id;

        return (
          <button
            key={round.round_number}
            onClick={() =>
              onSelectRound(isSelected ? null : round.round_number)
            }
            className={`w-full flex items-center justify-between px-3 py-2 text-sm border transition-all ${
              isSelected
                ? "border-[var(--arcade-blue)] bg-[var(--arcade-blue)]/10 neon-border-blue"
                : "border-[var(--border)] bg-[var(--surface-light)] hover:bg-[var(--border)]"
            }`}
          >
            <span className="font-mono text-gray-400">
              Round {round.round_number}
            </span>
            <span className="text-xs text-gray-500">
              {round.move_count} moves
            </span>
            <span
              className={`font-semibold text-xs ${
                round.is_draw
                  ? "text-gray-400"
                  : isP1Winner
                  ? "text-[var(--primary)] neon-text-red"
                  : isP2Winner
                  ? "text-[var(--accent)] neon-text-yellow"
                  : ""
              }`}
            >
              {winnerName}
            </span>
          </button>
        );
      })}
    </div>
  );
}
