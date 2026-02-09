"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface MatchSummary {
  id: string;
  game_type?: string;
  player1: { id: string; username: string; avatar_url: string | null };
  player2: { id: string; username: string; avatar_url: string | null };
  player1_score: number;
  player2_score: number;
  winner_id: string | null;
  status: string;
  entry_fee: string;
  player1_payment_receipt?: string | null;
  player2_payment_receipt?: string | null;
  payout_tx?: string | null;
  current_round?: number;
  move_count?: number;
  created_at: string;
  completed_at: string | null;
}

function MatchCard({ match }: { match: MatchSummary }) {
  const isLive = match.status === "in_progress";
  const isDraw = match.status === "draw";
  const winner =
    match.winner_id === match.player1.id
      ? match.player1
      : match.winner_id === match.player2.id
      ? match.player2
      : null;

  const gameType = match.game_type?.toUpperCase() ?? "RPS";
  const matchUrl =
    match.game_type === "ttt"
      ? `/ttt/matches/${match.id}`
      : `/matches/${match.id}`;

  // Parse payment receipts to extract transaction hashes
  const getTransactionHash = (receipt: string | null | undefined): string | null => {
    if (!receipt) return null;
    try {
      const parsed = JSON.parse(receipt);
      return parsed.transaction || null;
    } catch {
      return null;
    }
  };

  const player1StakeTx = getTransactionHash(match.player1_payment_receipt);
  const player2StakeTx = getTransactionHash(match.player2_payment_receipt);

  return (
    <Link
      href={matchUrl}
      className="block bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--accent)] transition-colors"
    >
      <div className="p-4">
        {/* Status badge + game type */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span
              className={`text-xs px-2 py-0.5 font-bold border ${
                gameType === "TTT"
                  ? "bg-purple-500/20 text-purple-400 border-purple-500"
                  : "bg-blue-500/20 text-blue-400 border-blue-500"
              }`}
            >
              {gameType}
            </span>
            {isLive ? (
              <span className="text-xs px-2 py-1 bg-[var(--accent)]/20 text-[var(--accent-light)] border border-[var(--accent)]">
                LIVE {match.current_round ? `- Round ${match.current_round}` : match.move_count != null ? `- Move ${match.move_count}` : ""}
              </span>
            ) : isDraw ? (
              <span className="text-xs px-2 py-1 bg-yellow-500/20 text-yellow-400 border border-yellow-500">
                DRAW
              </span>
            ) : match.status === "forfeited" ? (
              <span className="text-xs px-2 py-1 bg-red-500/20 text-red-400 border border-red-500">
                FORFEITED
              </span>
            ) : (
              <span className="text-xs px-2 py-1 bg-gray-500/20 text-gray-400 border border-gray-500">
                COMPLETED
              </span>
            )}
          </div>
          <span className="text-xs text-gray-500">
            {new Date(match.created_at).toLocaleDateString()}
          </span>
        </div>

        {/* Players */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                winner?.id === match.player1.id
                  ? "bg-green-500/20 text-green-400 ring-2 ring-green-500"
                  : "bg-[var(--accent)]/20 text-[var(--accent-light)]"
              }`}
            >
              {match.player1.username.charAt(0).toUpperCase()}
            </div>
            <span
              className={
                winner?.id === match.player1.id
                  ? "text-green-400 font-semibold"
                  : ""
              }
            >
              {match.player1.username}
            </span>
          </div>

          <div className="text-center">
            <div className="text-xl font-bold font-mono">
              {match.player1_score} - {match.player2_score}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={
                winner?.id === match.player2.id
                  ? "text-green-400 font-semibold"
                  : ""
              }
            >
              {match.player2.username}
            </span>
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                winner?.id === match.player2.id
                  ? "bg-green-500/20 text-green-400 ring-2 ring-green-500"
                  : "bg-[var(--warning)]/20 text-[var(--warning)]"
              }`}
            >
              {match.player2.username.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>

        {/* Transactions */}
        {(player1StakeTx || player2StakeTx || match.payout_tx) && (
          <div className="mt-3 pt-3 border-t border-[var(--border)]">
            <div className="grid grid-cols-2 gap-2 text-xs">
              {player1StakeTx && (
                <div>
                  <span className="text-gray-500">
                    {match.player1.username} stake:
                  </span>{" "}
                  <a
                    href={`https://monadscan.com/tx/${player1StakeTx}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {player1StakeTx.slice(0, 6)}...
                    {player1StakeTx.slice(-4)}
                  </a>
                </div>
              )}
              {player2StakeTx && (
                <div>
                  <span className="text-gray-500">
                    {match.player2.username} stake:
                  </span>{" "}
                  <a
                    href={`https://monadscan.com/tx/${player2StakeTx}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {player2StakeTx.slice(0, 6)}...
                    {player2StakeTx.slice(-4)}
                  </a>
                </div>
              )}

              {match.payout_tx && winner && (
                <div className="col-span-2">
                  <span className="text-gray-500">Payout to {winner.username}:</span>{" "}
                  <a
                    href={`https://monadscan.com/tx/${match.payout_tx}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-400 hover:text-green-300 underline font-semibold"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {(parseFloat(match.entry_fee) * 2).toFixed(2)} USDC
                  </a>{" "}
                  <span className="text-gray-600">
                    ({match.payout_tx.slice(0, 6)}...{match.payout_tx.slice(-4)})
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}

export default function MatchesPage() {
  const [liveMatches, setLiveMatches] = useState<MatchSummary[]>([]);
  const [pastMatches, setPastMatches] = useState<MatchSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    // Fetch live matches from both games
    Promise.all([
      fetch("/api/v1/matches/live").then((r) => r.json()),
      fetch("/api/v1/ttt/live").then((r) => r.json()),
    ])
      .then(([rpsData, tttData]) => {
        const all = [
          ...(rpsData.matches || []),
          ...(tttData.matches || []),
        ].sort(
          (a: MatchSummary, b: MatchSummary) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setLiveMatches(all);
      })
      .catch(console.error);

    // Fetch past matches from both games
    Promise.all([
      fetch(`/api/v1/matches/history?page=${page}&limit=10`).then((r) => r.json()),
      fetch(`/api/v1/ttt/history?page=${page}&limit=10`).then((r) => r.json()),
    ])
      .then(([rpsData, tttData]) => {
        const all = [
          ...(rpsData.matches || []),
          ...(tttData.matches || []),
        ].sort(
          (a: MatchSummary, b: MatchSummary) =>
            new Date(b.completed_at || b.created_at).getTime() -
            new Date(a.completed_at || a.created_at).getTime()
        );
        setPastMatches(all);
        setLoading(false);
      })
      .catch(console.error);
  }, [page]);

  // Poll live matches
  useEffect(() => {
    const interval = setInterval(() => {
      Promise.all([
        fetch("/api/v1/matches/live").then((r) => r.json()),
        fetch("/api/v1/ttt/live").then((r) => r.json()),
      ])
        .then(([rpsData, tttData]) => {
          const all = [
            ...(rpsData.matches || []),
            ...(tttData.matches || []),
          ].sort(
            (a: MatchSummary, b: MatchSummary) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
          );
          setLiveMatches(all);
        })
        .catch(console.error);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6 text-[var(--primary)]">All Matches</h1>

      {/* Live Matches */}
      {liveMatches.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
            Live Matches
          </h2>
          <div className="space-y-3">
            {liveMatches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        </section>
      )}

      {/* Past Matches */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Recent Matches</h2>
        {loading ? (
          <div className="text-center text-gray-400 py-8">Loading...</div>
        ) : pastMatches.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            No matches found.
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {pastMatches.map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>

            {/* Pagination */}
            <div className="flex justify-center gap-4 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 bg-[var(--surface)] border border-[var(--border)] disabled:opacity-50 disabled:cursor-not-allowed hover:border-[var(--accent)]"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-gray-400">Page {page}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={pastMatches.length < 20}
                className="px-4 py-2 bg-[var(--surface)] border border-[var(--border)] disabled:opacity-50 disabled:cursor-not-allowed hover:border-[var(--accent)]"
              >
                Next
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
