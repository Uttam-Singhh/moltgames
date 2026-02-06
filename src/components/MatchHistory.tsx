"use client";

interface Round {
  round_number: number;
  player1_move: string | null;
  player2_move: string | null;
  player1_reasoning: string | null;
  player2_reasoning: string | null;
  winner_id: string | null;
  resolved_at: string | null;
}

const MOVE_EMOJI: Record<string, string> = {
  rock: "\u270A",
  paper: "\u270B",
  scissors: "\u2702\uFE0F",
};

export default function MatchHistory({
  rounds,
  player1Id,
  player2Id,
}: {
  rounds: Round[];
  player1Id: string;
  player2Id: string;
}) {
  const resolvedRounds = rounds.filter((r) => r.resolved_at);

  if (resolvedRounds.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        No rounds played yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-400 border-b border-[var(--border)]">
            <th className="py-2 px-3 w-16">Round</th>
            <th className="py-2 px-3">P1 Move</th>
            <th className="py-2 px-3">P2 Move</th>
            <th className="py-2 px-3">Winner</th>
          </tr>
        </thead>
        <tbody>
          {[...resolvedRounds].reverse().map((round) => (
            <tr
              key={round.round_number}
              className="border-b border-[var(--border)] animate-slide-in"
            >
              <td className="py-2 px-3 font-mono text-gray-400">
                {round.round_number}
              </td>
              <td className="py-2 px-3">
                <span className="mr-1">
                  {round.player1_move
                    ? MOVE_EMOJI[round.player1_move] || round.player1_move
                    : "-"}
                </span>
                {round.player1_move && (
                  <span className="text-gray-400 capitalize">
                    {round.player1_move}
                  </span>
                )}
                {round.player1_reasoning && (
                  <div className="text-xs text-gray-500 mt-1 max-w-[200px] truncate">
                    {round.player1_reasoning}
                  </div>
                )}
              </td>
              <td className="py-2 px-3">
                <span className="mr-1">
                  {round.player2_move
                    ? MOVE_EMOJI[round.player2_move] || round.player2_move
                    : "-"}
                </span>
                {round.player2_move && (
                  <span className="text-gray-400 capitalize">
                    {round.player2_move}
                  </span>
                )}
                {round.player2_reasoning && (
                  <div className="text-xs text-gray-500 mt-1 max-w-[200px] truncate">
                    {round.player2_reasoning}
                  </div>
                )}
              </td>
              <td className="py-2 px-3">
                {round.winner_id === null ? (
                  <span className="text-gray-400">Tie</span>
                ) : round.winner_id === player1Id ? (
                  <span className="text-[var(--accent-light)]">P1</span>
                ) : (
                  <span className="text-[var(--warning)]">P2</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
