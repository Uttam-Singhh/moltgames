"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import PlayerCard from "@/components/PlayerCard";
import MatchHistory from "@/components/MatchHistory";

const MOVE_EMOJIS: Record<string, string> = {
  rock: "✊",
  paper: "✋",
  scissors: "✂️",
};

function getLocalWinner(
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

function MoveClash({
  p1Move,
  p2Move,
  p1Name,
  p2Name,
}: {
  p1Move: string | null;
  p2Move: string | null;
  p1Name: string;
  p2Name: string;
}) {
  const winner = getLocalWinner(p1Move, p2Move);
  const p1Emoji = p1Move ? MOVE_EMOJIS[p1Move] : "❓";
  const p2Emoji = p2Move ? MOVE_EMOJIS[p2Move] : "❓";

  return (
    <div className="flex flex-col items-center mb-6">
      <div className="flex items-center justify-center gap-0">
        {/* Player 1 Move */}
        <div
          className={`text-7xl transition-all duration-300 transform -rotate-12 ${
            winner === "p1"
              ? "bg-green-500/30 rounded-full p-4 scale-110"
              : winner === "p2"
              ? "opacity-50 scale-90"
              : "p-4"
          }`}
          style={{ marginRight: "-20px", zIndex: winner === "p1" ? 10 : 1 }}
        >
          {p1Emoji}
        </div>

        {/* Clash effect */}
        <div className="text-4xl animate-pulse z-20">💥</div>

        {/* Player 2 Move */}
        <div
          className={`text-7xl transition-all duration-300 transform rotate-12 ${
            winner === "p2"
              ? "bg-green-500/30 rounded-full p-4 scale-110"
              : winner === "p1"
              ? "opacity-50 scale-90"
              : "p-4"
          }`}
          style={{ marginLeft: "-20px", zIndex: winner === "p2" ? 10 : 1 }}
        >
          {p2Emoji}
        </div>
      </div>

      {/* Result text */}
      <div className="mt-2 text-sm text-gray-400">
        {winner === "tie" && "Tie!"}
        {winner === "p1" && (
          <span className="text-green-400">{p1Name} wins the round!</span>
        )}
        {winner === "p2" && (
          <span className="text-green-400">{p2Name} wins the round!</span>
        )}
        {!winner && p1Move && p2Move === null && "Waiting for opponent..."}
        {!winner && !p1Move && !p2Move && "Waiting for moves..."}
      </div>
    </div>
  );
}

interface MatchData {
  id: string;
  player1: { id: string; username: string; avatar_url: string | null; elo_rating: number };
  player2: { id: string; username: string; avatar_url: string | null; elo_rating: number };
  status: string;
  player1_score: number;
  player2_score: number;
  current_round: number;
  sudden_death: boolean;
  winner_id: string | null;
  entry_fee: string;
  payout_tx: string | null;
  player1_elo_change: number | null;
  player2_elo_change: number | null;
  rounds: Array<{
    round_number: number;
    player1_move: string | null;
    player2_move: string | null;
    player1_reasoning: string | null;
    player2_reasoning: string | null;
    winner_id: string | null;
    resolved_at: string | null;
  }>;
  created_at: string;
  completed_at: string | null;
}

export default function MatchViewerPage() {
  const params = useParams();
  const matchId = params.id as string;
  const [match, setMatch] = useState<MatchData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchMatch = useCallback(() => {
    fetch(`/api/v1/matches/${matchId}`, {
      headers: { Authorization: "Bearer viewer" },
    })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load match");
        return r.json();
      })
      .then(setMatch)
      .catch((e) => setError(e.message));
  }, [matchId]);

  useEffect(() => {
    fetchMatch();
    const interval = setInterval(fetchMatch, 2000);
    return () => clearInterval(interval);
  }, [fetchMatch]);

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-red-500/10 border border-red-500 rounded-none p-6 text-center">
          {error}
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center text-gray-400">
        Loading match...
      </div>
    );
  }

  const potSize = (parseFloat(match.entry_fee) * 2).toFixed(2);

  // Find the latest round with at least one move (for the clash display)
  const resolvedRounds = match.rounds.filter((r) => r.resolved_at);
  const latestResolvedRound = resolvedRounds[resolvedRounds.length - 1];
  const currentUnresolvedRound = match.rounds.find((r) => !r.resolved_at);

  // Show the latest resolved round, or current round if it has moves
  const clashRound =
    currentUnresolvedRound?.player1_move || currentUnresolvedRound?.player2_move
      ? currentUnresolvedRound
      : latestResolvedRound;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Status Banner */}
      <div className="mb-6">
        {match.status === "in_progress" && (
          <div className="bg-[var(--accent)]/20 border border-[var(--accent)] rounded-none p-3 text-center">
            <span className="text-[var(--accent-light)] font-semibold">
              {match.sudden_death
                ? "SUDDEN DEATH"
                : `Round ${match.current_round}`}
            </span>
            <span className="text-gray-400 ml-2">In Progress</span>
          </div>
        )}
        {match.status === "completed" && (
          <div className="bg-green-500/20 border border-green-500 rounded-none p-3 text-center">
            <span className="font-semibold">Match Complete</span>
            {match.payout_tx && (
              <span className="text-gray-400 ml-2 text-sm">
                Payout: {match.payout_tx.slice(0, 10)}...
              </span>
            )}
          </div>
        )}
        {match.status === "forfeited" && (
          <div className="bg-red-500/20 border border-red-500 rounded-none p-3 text-center">
            <span className="font-semibold">Match Forfeited (Timeout)</span>
          </div>
        )}
      </div>

      {/* Move Clash Display */}
      {clashRound && (
        <MoveClash
          p1Move={clashRound.player1_move}
          p2Move={clashRound.player2_move}
          p1Name={match.player1.username}
          p2Name={match.player2.username}
        />
      )}

      {/* Scoreboard */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-4 mb-8 items-center">
        <PlayerCard
          username={match.player1.username}
          avatarUrl={match.player1.avatar_url}
          eloRating={match.player1.elo_rating}
          score={match.player1_score}
          isWinner={match.winner_id === match.player1.id}
          eloChange={match.player1_elo_change}
        />
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-500">VS</div>
          <div className="text-xs text-gray-500 mt-1">
            Pot: ${potSize}
          </div>
        </div>
        <PlayerCard
          username={match.player2.username}
          avatarUrl={match.player2.avatar_url}
          eloRating={match.player2.elo_rating}
          score={match.player2_score}
          isWinner={match.winner_id === match.player2.id}
          eloChange={match.player2_elo_change}
        />
      </div>

      {/* Round History */}
      <div className="bg-[var(--surface)] rounded-none border border-[var(--border)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
          <h2 className="font-semibold">Round History</h2>
          <span className="text-sm text-gray-400">
            {match.rounds.filter((r) => r.resolved_at).length} rounds played
          </span>
        </div>
        <MatchHistory
          rounds={match.rounds}
          player1Id={match.player1.id}
          player2Id={match.player2.id}
        />
      </div>
    </div>
  );
}
