"use client";

import { TETRIS_CONSTANTS } from "@/lib/constants";

const { PIECE_COLORS } = TETRIS_CONSTANTS;

interface TetrisBoardProps {
  board: string;
  highlightCells?: [number, number][];
  label?: string;
  score?: number;
  lines?: number;
  level?: number;
  alive?: boolean;
  compact?: boolean;
}

export default function TetrisBoard({
  board,
  highlightCells,
  label,
  score,
  lines,
  level,
  alive = true,
  compact = false,
}: TetrisBoardProps) {
  const WIDTH = 10;
  const HEIGHT = 20;

  const cellSize = compact ? "w-3 h-3" : "w-5 h-5";

  const isHighlighted = (row: number, col: number) =>
    highlightCells?.some(([r, c]) => r === row && c === col) ?? false;

  return (
    <div className="relative inline-block">
      {label && (
        <div className="text-center mb-2 arcade-heading text-xs text-[var(--arcade-blue)]">
          {label}
        </div>
      )}

      <div
        className="border-2 border-[var(--arcade-blue)]/40 bg-[var(--background)] inline-block"
        style={{ boxShadow: "0 0 8px rgba(68, 136, 255, 0.2)" }}
      >
        {Array.from({ length: HEIGHT }, (_, row) => (
          <div key={row} className="flex">
            {Array.from({ length: WIDTH }, (_, col) => {
              const idx = row * WIDTH + col;
              const cell = board[idx] ?? ".";
              const filled = cell !== ".";
              const highlighted = isHighlighted(row, col);
              const color = filled ? PIECE_COLORS[cell] ?? PIECE_COLORS["#"] : null;

              return (
                <div
                  key={col}
                  className={`${cellSize} border ${
                    highlighted
                      ? "bg-[var(--arcade-pink)] border-[var(--arcade-pink)]"
                      : filled
                      ? "border-[var(--border)]/20"
                      : "bg-[var(--background)] border-[var(--border)]/20"
                  }`}
                  style={
                    highlighted
                      ? { boxShadow: "0 0 4px rgba(255, 68, 136, 0.6)" }
                      : filled && color
                      ? {
                          backgroundColor: color.bg,
                          borderColor: color.border,
                          boxShadow: `inset 0 0 2px ${color.shadow}`,
                        }
                      : undefined
                  }
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Game Over overlay */}
      {!alive && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <span className="arcade-heading text-sm text-[var(--danger)] neon-text-red">
            GAME OVER
          </span>
        </div>
      )}

      {/* Stats below board */}
      {(score != null || lines != null || level != null) && (
        <div className="flex justify-between mt-2 text-xs font-mono text-gray-400 px-1">
          {score != null && (
            <span>
              SCR <span className="text-[var(--accent)]">{score}</span>
            </span>
          )}
          {lines != null && (
            <span>
              LNS <span className="text-[var(--arcade-blue)]">{lines}</span>
            </span>
          )}
          {level != null && (
            <span>
              LVL <span className="text-[var(--success)]">{level}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
