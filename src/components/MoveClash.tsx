"use client";

const MOVE_EMOJIS: Record<string, string> = {
  rock: "\u270A",
  paper: "\u270B",
  scissors: "\u2702\uFE0F",
};

export function getLocalWinner(
  p1Move: string | null,
  p2Move: string | null
): "p1" | "p2" | "tie" | null {
  if (!p1Move || !p2Move) return null;
  if (p1Move === p2Move) return "tie";
  if (
    (p1Move === "rock" && p2Move === "scissors") ||
    (p1Move === "scissors" && p2Move === "paper") ||
    (p1Move === "paper" && p2Move === "rock")
  ) {
    return "p1";
  }
  return "p2";
}

export default function MoveClash({
  p1Move,
  p2Move,
  p1Name,
  p2Name,
  roundKey,
}: {
  p1Move: string | null;
  p2Move: string | null;
  p1Name: string;
  p2Name: string;
  roundKey: number;
}) {
  const winner = getLocalWinner(p1Move, p2Move);
  const p1Emoji = p1Move ? MOVE_EMOJIS[p1Move] : "\u2753";
  const p2Emoji = p2Move ? MOVE_EMOJIS[p2Move] : "\u2753";
  const bothRevealed = p1Move && p2Move;

  return (
    <div className="flex flex-col items-center mb-6 overflow-hidden" key={roundKey}>
      <div className="flex items-center justify-center gap-0 relative">
        {/* Player 1 Move */}
        <div
          className={`text-7xl transition-all duration-300 transform ${
            bothRevealed ? "animate-crash-left" : ""
          } ${
            winner === "p1"
              ? "animate-winner-glow scale-110"
              : winner === "p2"
              ? "opacity-50 scale-90"
              : ""
          }`}
          style={{ marginRight: "-20px", zIndex: winner === "p1" ? 10 : 1 }}
        >
          {p1Emoji}
        </div>

        {/* Impact flash */}
        {bothRevealed && (
          <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
            <div className="w-16 h-16 rounded-full bg-[var(--accent)] opacity-0 animate-impact-flash" />
          </div>
        )}

        {/* Clash effect */}
        <div className="text-4xl animate-pulse z-20" style={{ filter: 'drop-shadow(0 0 8px rgba(255,204,0,0.6))' }}>{"\uD83D\uDCA5"}</div>

        {/* Player 2 Move */}
        <div
          className={`text-7xl transition-all duration-300 transform ${
            bothRevealed ? "animate-crash-right" : ""
          } ${
            winner === "p2"
              ? "animate-winner-glow scale-110"
              : winner === "p1"
              ? "opacity-50 scale-90"
              : ""
          }`}
          style={{ marginLeft: "-20px", zIndex: winner === "p2" ? 10 : 1 }}
        >
          {p2Emoji}
        </div>
      </div>

      {/* Result text */}
      <div className="mt-2 text-sm text-gray-400">
        {winner === "tie" && <span className="text-[var(--accent)]">Tie!</span>}
        {winner === "p1" && (
          <span className="text-[var(--success)] neon-text-green font-semibold">{p1Name} wins the round!</span>
        )}
        {winner === "p2" && (
          <span className="text-[var(--success)] neon-text-green font-semibold">{p2Name} wins the round!</span>
        )}
        {!winner && p1Move && p2Move === null && "Waiting for opponent..."}
        {!winner && !p1Move && !p2Move && "Waiting for moves..."}
      </div>
    </div>
  );
}
