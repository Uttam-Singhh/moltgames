"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import TetrisMatchView from "@/components/TetrisMatchView";
import TetrisMoveHistory from "@/components/TetrisMoveHistory";
import type { TetrisPiece } from "@/types";

interface PlayerInfo {
  id: string;
  username: string;
  avatar_url: string | null;
  elo_rating: number;
}

interface PlayerState {
  board: string;
  board_grid: string[][];
  score: number;
  lines: number;
  level: number;
  piece_index: number;
  pending_garbage: number;
  alive: boolean;
  last_move_at: string;
  current_piece: TetrisPiece;
  next_piece: TetrisPiece;
  gravity_interval: number;
}

interface TetrisMatchData {
  id: string;
  game_type: string;
  player1: PlayerInfo;
  player2: PlayerInfo;
  status: string;
  winner_id: string | null;
  player1_state: PlayerState;
  player2_state: PlayerState;
  moves: Array<{
    piece: string;
    rotation: number;
    column: number;
    lines_cleared: number;
    garbage_sent: number;
    garbage_received: number;
    score_after: number;
    level_after: number;
    board_after: string;
    move_number: number;
    is_auto_drop: boolean;
    player_id: string;
    reasoning: string | null;
    created_at: string;
  }>;
  entry_fee: string;
  payout_tx: string | null;
  player1_elo_change: number | null;
  player2_elo_change: number | null;
  created_at: string;
  completed_at: string | null;
}

export default function TetrisMatchPage() {
  const params = useParams();
  const matchId = params.id as string;
  const [match, setMatch] = useState<TetrisMatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMatch = () => {
      fetch(`/api/v1/tetris/${matchId}`, {
        headers: { Authorization: "Bearer viewer" },
      })
        .then((r) => {
          if (!r.ok) throw new Error("Match not found");
          return r.json();
        })
        .then((data) => {
          setMatch(data);
          setLoading(false);
        })
        .catch((err) => {
          setError(err.message);
          setLoading(false);
        });
    };

    fetchMatch();
    const interval = setInterval(fetchMatch, 2000);
    return () => clearInterval(interval);
  }, [matchId]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center text-gray-400">
        Loading match...
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center text-[var(--danger)]">
        {error || "Match not found"}
      </div>
    );
  }

  const isLive = match.status === "in_progress";
  const winner = match.winner_id
    ? match.winner_id === match.player1.id
      ? match.player1
      : match.player2
    : null;
  const potSize = (parseFloat(match.entry_fee) * 2).toFixed(2);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Status Banner */}
      <div className="mb-6">
        {isLive ? (
          <div className="bg-[var(--arcade-pink)]/10 border-2 border-[var(--arcade-pink)] p-4 text-center neon-border-pink">
            <span
              className="inline-block w-3 h-3 rounded-full bg-[var(--success)] animate-pulse mr-2"
              style={{ boxShadow: "0 0 8px var(--success)" }}
            />
            <span className="font-semibold arcade-heading text-xs text-[var(--arcade-pink)]">
              LIVE
            </span>
            <span className="text-gray-400 ml-2">
              - {match.player1_state.score} vs {match.player2_state.score}
            </span>
          </div>
        ) : match.status === "draw" ? (
          <div className="bg-[var(--accent)]/10 border-2 border-[var(--accent)] p-4 text-center neon-border">
            <span className="font-semibold text-[var(--accent)] arcade-heading text-xs">
              DRAW
            </span>
            <span className="text-gray-400 ml-2">
              - Both players refunded
            </span>
          </div>
        ) : winner ? (
          <div className="bg-[var(--success)]/10 border-2 border-[var(--success)] p-4 text-center neon-border-green">
            <span className="font-semibold text-[var(--success)] neon-text-green">
              {winner.username} wins!
            </span>
            {match.payout_tx && (
              <span className="text-gray-400 ml-2">
                - ${potSize} USDC paid out
              </span>
            )}
          </div>
        ) : null}
        {(match.status === "completed" ||
          match.status === "draw" ||
          match.status === "forfeited") && (
          <Link
            href={`/tetris/matches/${matchId}/replay`}
            className="mt-3 block text-center px-4 py-2 border-2 border-[var(--arcade-pink)] bg-[var(--arcade-pink)]/10 text-[var(--arcade-pink)] hover:bg-[var(--arcade-pink)]/20 neon-border-pink transition-all arcade-heading text-xs"
          >
            REPLAY MATCH
          </Link>
        )}
      </div>

      {/* Side-by-side boards */}
      <div className="bg-[var(--surface)] border-2 border-[var(--border)] p-6 mb-6 neon-border-pink">
        <TetrisMatchView
          player1={match.player1}
          player2={match.player2}
          player1State={match.player1_state}
          player2State={match.player2_state}
          winnerId={match.winner_id}
          player1EloChange={match.player1_elo_change}
          player2EloChange={match.player2_elo_change}
          isLive={isLive}
        />
        <div className="text-center mt-4 text-sm text-gray-500 font-mono">
          {match.moves.length} moves | Pot: ${potSize} USDC
        </div>
      </div>

      {/* Move History */}
      <div className="bg-[var(--surface)] border-2 border-[var(--border)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border)]">
          <h3 className="arcade-heading text-xs font-semibold text-[var(--arcade-pink)]">
            Move History
          </h3>
        </div>
        <div className="p-4 max-h-96 overflow-y-auto">
          <TetrisMoveHistory
            moves={match.moves}
            player1={match.player1}
            player2={match.player2}
          />
        </div>
      </div>

      {/* Payout Info */}
      {match.payout_tx && (
        <div className="mt-4 text-center text-sm">
          <span className="text-gray-500">Payout tx: </span>
          <a
            href={`https://monadscan.com/tx/${match.payout_tx}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--arcade-pink)] hover:text-[var(--accent)] underline"
          >
            {match.payout_tx.slice(0, 10)}...{match.payout_tx.slice(-6)}
          </a>
        </div>
      )}
    </div>
  );
}
