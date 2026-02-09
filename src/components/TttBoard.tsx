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
            className={`w-20 h-20 flex items-center justify-center text-3xl font-bold border border-[var(--border)] ${
              isWinner
                ? "bg-[var(--success)]/20 border-[var(--success)]"
                : isLastMove
                ? "bg-[var(--accent)]/10 border-[var(--accent)]"
                : "bg-[var(--surface)]"
            }`}
          >
            {cell === "X" ? (
              <span className="text-[var(--accent-light)]">X</span>
            ) : cell === "O" ? (
              <span className="text-[var(--warning)]">O</span>
            ) : (
              <span className="text-gray-700 text-sm">{i}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
