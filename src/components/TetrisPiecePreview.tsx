"use client";

import { TETRIS_CONSTANTS } from "@/lib/constants";
import type { TetrisPiece } from "@/types";

const { PIECE_COLORS } = TETRIS_CONSTANTS;

interface TetrisPiecePreviewProps {
  piece: TetrisPiece;
  label?: string;
}

export default function TetrisPiecePreview({
  piece,
  label,
}: TetrisPiecePreviewProps) {
  const offsets = TETRIS_CONSTANTS.PIECES[piece]?.[0] as
    | [number, number][]
    | undefined;

  if (!offsets) return null;

  const color = PIECE_COLORS[piece] ?? PIECE_COLORS["#"];

  // Create a 4x4 grid and mark piece cells
  const grid = Array.from({ length: 4 }, () => Array(4).fill(false));
  for (const [r, c] of offsets) {
    if (r >= 0 && r < 4 && c >= 0 && c < 4) {
      grid[r][c] = true;
    }
  }

  return (
    <div className="inline-block">
      {label && (
        <div className="text-center mb-1 text-[10px] font-mono text-gray-500 uppercase">
          {label}
        </div>
      )}
      <div
        className="border border-[var(--border)] bg-[var(--background)] p-1 inline-block"
        style={{ boxShadow: `0 0 4px ${color.shadow}` }}
      >
        {grid.map((row, r) => (
          <div key={r} className="flex">
            {row.map((filled: boolean, c: number) => (
              <div
                key={c}
                className={`w-3 h-3 ${
                  filled
                    ? "border"
                    : "bg-transparent"
                }`}
                style={
                  filled
                    ? {
                        backgroundColor: color.bg,
                        borderColor: color.border,
                        boxShadow: `inset 0 0 2px ${color.shadow}`,
                      }
                    : undefined
                }
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
