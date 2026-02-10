"use client";

import TetrisBoard from "./TetrisBoard";
import TetrisPiecePreview from "./TetrisPiecePreview";
import PlayerCard from "./PlayerCard";
import type { TetrisPiece } from "@/types";

interface PlayerInfo {
  id: string;
  username: string;
  avatar_url: string | null;
  elo_rating: number;
}

interface PlayerState {
  board: string;
  score: number;
  lines: number;
  level: number;
  pending_garbage: number;
  alive: boolean;
  current_piece: TetrisPiece;
  next_piece: TetrisPiece;
  gravity_interval: number;
}

interface TetrisMatchViewProps {
  player1: PlayerInfo;
  player2: PlayerInfo;
  player1State: PlayerState;
  player2State: PlayerState;
  winnerId: string | null;
  player1EloChange: number | null;
  player2EloChange: number | null;
  isLive?: boolean;
}

export default function TetrisMatchView({
  player1,
  player2,
  player1State,
  player2State,
  winnerId,
  player1EloChange,
  player2EloChange,
  isLive,
}: TetrisMatchViewProps) {
  return (
    <div>
      {/* Player Cards */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-xs text-gray-500 mb-1 text-center font-mono">
            Player 1
          </div>
          <PlayerCard
            username={player1.username}
            avatarUrl={player1.avatar_url}
            eloRating={player1.elo_rating}
            isWinner={winnerId === player1.id}
            eloChange={player1EloChange}
          />
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1 text-center font-mono">
            Player 2
          </div>
          <PlayerCard
            username={player2.username}
            avatarUrl={player2.avatar_url}
            eloRating={player2.elo_rating}
            isWinner={winnerId === player2.id}
            eloChange={player2EloChange}
          />
        </div>
      </div>

      {/* Boards side by side */}
      <div className="grid grid-cols-2 gap-4">
        {/* Player 1 Board */}
        <div className="flex flex-col items-center">
          <div className="flex items-start gap-2 mb-2">
            <TetrisPiecePreview piece={player1State.current_piece} label="Current" />
            <TetrisPiecePreview piece={player1State.next_piece} label="Next" />
          </div>
          <TetrisBoard
            board={player1State.board}
            score={player1State.score}
            lines={player1State.lines}
            level={player1State.level}
            alive={player1State.alive}
          />
          {player1State.pending_garbage > 0 && (
            <div className="mt-1 text-xs font-mono text-[var(--danger)]">
              +{player1State.pending_garbage} garbage incoming
            </div>
          )}
          {isLive && player1State.alive && (
            <div className="mt-1 text-[10px] font-mono text-gray-500">
              Gravity: {player1State.gravity_interval}s
            </div>
          )}
        </div>

        {/* Player 2 Board */}
        <div className="flex flex-col items-center">
          <div className="flex items-start gap-2 mb-2">
            <TetrisPiecePreview piece={player2State.current_piece} label="Current" />
            <TetrisPiecePreview piece={player2State.next_piece} label="Next" />
          </div>
          <TetrisBoard
            board={player2State.board}
            score={player2State.score}
            lines={player2State.lines}
            level={player2State.level}
            alive={player2State.alive}
          />
          {player2State.pending_garbage > 0 && (
            <div className="mt-1 text-xs font-mono text-[var(--danger)]">
              +{player2State.pending_garbage} garbage incoming
            </div>
          )}
          {isLive && player2State.alive && (
            <div className="mt-1 text-[10px] font-mono text-gray-500">
              Gravity: {player2State.gravity_interval}s
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
