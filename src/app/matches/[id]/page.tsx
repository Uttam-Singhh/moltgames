"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import PlayerCard from "@/components/PlayerCard";
import MoveClash from "@/components/MoveClash";
import MatchHistory from "@/components/MatchHistory";

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
        <div className="bg-[var(--danger)]/10 border-2 border-[var(--danger)] rounded-none p-6 text-center neon-border-red">
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
          <div className="bg-[var(--primary)]/20 border-2 border-[var(--primary)] rounded-none p-3 text-center neon-border-red">
            <span className="text-[var(--primary)] font-semibold arcade-heading text-xs">
              {match.sudden_death
                ? "SUDDEN DEATH"
                : `Round ${match.current_round}`}
            </span>
            <span className="text-gray-400 ml-2">In Progress</span>
          </div>
        )}
        {match.status === "completed" && (
          <div className="bg-[var(--success)]/20 border-2 border-[var(--success)] rounded-none p-3 text-center neon-border-green">
            <span className="font-semibold text-[var(--success)]">Match Complete</span>
            {match.payout_tx && (
              <span className="text-gray-400 ml-2 text-sm">
                Payout: {match.payout_tx.slice(0, 10)}...
              </span>
            )}
          </div>
        )}
        {match.status === "forfeited" && (
          <div className="bg-[var(--danger)]/20 border-2 border-[var(--danger)] rounded-none p-3 text-center neon-border-red">
            <span className="font-semibold text-[var(--danger)]">Match Forfeited (Timeout)</span>
          </div>
        )}
        {(match.status === "completed" || match.status === "forfeited") && (
          <Link
            href={`/matches/${matchId}/replay`}
            className="mt-3 block text-center px-4 py-2 border-2 border-[var(--arcade-pink)] bg-[var(--arcade-pink)]/10 text-[var(--arcade-pink)] hover:bg-[var(--arcade-pink)]/20 neon-border-pink transition-all arcade-heading text-xs"
          >
            REPLAY MATCH
          </Link>
        )}
      </div>

      {/* Move Clash Display */}
      {clashRound && (
        <MoveClash
          p1Move={clashRound.player1_move}
          p2Move={clashRound.player2_move}
          p1Name={match.player1.username}
          p2Name={match.player2.username}
          roundKey={clashRound.round_number}
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
          <div className="arcade-heading text-2xl font-bold text-[var(--accent)] neon-text-yellow">VS</div>
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
      <div className="bg-[var(--surface)] rounded-none border-2 border-[var(--border)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
          <h2 className="arcade-heading text-xs font-semibold text-[var(--accent)]">Round History</h2>
          <span className="text-sm text-gray-400 font-mono">
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
