"use client";

interface TttBoardProps {
  board: string;
  lastMovePosition?: number;
  winningLine?: number[];
}

export default function TttBoard({
  board,
  lastMovePosition,
  winningLine,
}: TttBoardProps) {
  const cells = board.split("");

  const isWinningCell = (index: number) =>
    winningLine?.includes(index) ?? false;

  return (
    <div className="grid grid-cols-3 gap-1 w-fit mx-auto">
      {cells.map((cell, i) => {
        const isLastMove = i === lastMovePosition;
        const isWinner = isWinningCell(i);

        return (
          <div
            key={i}
            className={`w-20 h-20 flex items-center justify-center text-3xl font-bold border-2 ${
              isWinner
                ? "bg-[var(--success)]/20 border-[var(--success)] neon-border-green"
                : isLastMove
                ? "bg-[var(--arcade-pink)]/10 border-[var(--arcade-pink)] neon-border-pink"
                : "bg-[var(--surface)] border-[var(--arcade-blue)]/30"
            }`}
            style={!isWinner && !isLastMove ? { boxShadow: '0 0 4px rgba(68, 136, 255, 0.15)' } : undefined}
          >
            {cell === "X" ? (
              <span className="text-[var(--primary)] neon-text-red">X</span>
            ) : cell === "O" ? (
              <span className="text-[var(--accent)] neon-text-yellow">O</span>
            ) : (
              <span className="text-gray-700 text-sm">{i}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
