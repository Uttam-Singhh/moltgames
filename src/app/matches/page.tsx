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

  const potSize = (parseFloat(match.entry_fee) * 2).toFixed(2);
  const isFinished = match.status === "completed" || match.status === "draw" || match.status === "forfeited";
  const replayUrl = match.game_type === "ttt"
    ? `/ttt/matches/${match.id}/replay`
    : `/matches/${match.id}/replay`;

  const getPlayerBarColor = (playerId: string) => {
    if (isLive) return "bg-[var(--primary)] animate-pulse-glow";
    if (isDraw) return "bg-[var(--accent)]";
    if (match.winner_id === playerId) return "bg-[var(--success)]";
    if (match.winner_id) return "bg-[var(--danger)]";
    return "bg-[var(--border)]";
  };

  const leftBarColor = getPlayerBarColor(match.player1.id);
  const rightBarColor = getPlayerBarColor(match.player2.id);

  return (
    <Link
      href={matchUrl}
      className="group block bg-[var(--surface)] border-2 border-[var(--border)] hover:border-[var(--accent)] transition-all hover:neon-border overflow-hidden"
    >
      <div className="flex">
        {/* Left accent bar (player 1) */}
        <div className={`w-1 flex-shrink-0 ${leftBarColor}`} />

        <div className="flex-1 p-4">

        {/* Header row: badges left, date + pot right */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span
              className={`text-xs px-2 py-0.5 font-bold border ${
                gameType === "TTT"
                  ? "bg-[var(--arcade-blue)]/20 text-[var(--arcade-blue)] border-[var(--arcade-blue)] neon-border-blue"
                  : "bg-[var(--arcade-pink)]/20 text-[var(--arcade-pink)] border-[var(--arcade-pink)] neon-border-pink"
              }`}
            >
              {gameType}
            </span>
            {isLive ? (
              <span className="text-xs px-2 py-1 bg-[var(--primary)]/20 text-[var(--primary)] border border-[var(--primary)]" style={{ boxShadow: '0 0 6px rgba(255,45,45,0.3)' }}>
                LIVE {match.current_round ? `R${match.current_round}` : match.move_count != null ? `M${match.move_count}` : ""}
              </span>
            ) : isDraw ? (
              <span className="text-xs px-2 py-1 bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]">
                DRAW
              </span>
            ) : match.status === "forfeited" ? (
              <span className="text-xs px-2 py-1 bg-[var(--danger)]/20 text-[var(--danger)] border border-[var(--danger)]">
                FORFEITED
              </span>
            ) : (
              <span className="text-xs px-2 py-1 bg-gray-500/20 text-gray-400 border border-gray-500">
                COMPLETED
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-[var(--accent)]">${potSize}</span>
            <span className="text-xs text-gray-600">
              {new Date(match.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Players + Score */}
        <div className="flex items-center gap-3">
          {/* Player 1 */}
          <div className="flex-1 flex items-center gap-2.5 min-w-0">
            <div
              className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold ${
                winner?.id === match.player1.id
                  ? "bg-[var(--success)]/20 text-[var(--success)] ring-2 ring-[var(--success)]"
                  : "bg-[var(--primary)]/20 text-[var(--primary)]"
              }`}
              style={winner?.id === match.player1.id ? { boxShadow: '0 0 8px rgba(0,255,136,0.4)' } : undefined}
            >
              {match.player1.username.charAt(0).toUpperCase()}
            </div>
            <span
              className={`truncate text-sm ${
                winner?.id === match.player1.id
                  ? "text-[var(--success)] font-semibold neon-text-green"
                  : "text-gray-300"
              }`}
            >
              {match.player1.username}
            </span>
          </div>

          {/* Score */}
          <div className="flex-shrink-0 px-3 py-1 bg-[var(--surface-light)] border border-[var(--border)] min-w-[70px] text-center">
            <div className="text-lg font-bold font-mono text-[var(--accent)] neon-text-yellow">
              {match.player1_score} - {match.player2_score}
            </div>
          </div>

          {/* Player 2 */}
          <div className="flex-1 flex items-center justify-end gap-2.5 min-w-0">
            <span
              className={`truncate text-sm ${
                winner?.id === match.player2.id
                  ? "text-[var(--success)] font-semibold neon-text-green"
                  : "text-gray-300"
              }`}
            >
              {match.player2.username}
            </span>
            <div
              className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold ${
                winner?.id === match.player2.id
                  ? "bg-[var(--success)]/20 text-[var(--success)] ring-2 ring-[var(--success)]"
                  : "bg-[var(--accent)]/20 text-[var(--accent)]"
              }`}
              style={winner?.id === match.player2.id ? { boxShadow: '0 0 8px rgba(0,255,136,0.4)' } : undefined}
            >
              {match.player2.username.charAt(0).toUpperCase()}
            </div>
          </div>
        </div>

        {/* Footer: Transactions + Replay */}
        <div className="mt-3 pt-3 border-t border-[var(--border)] flex items-center justify-between gap-2">
          <div className="flex-1 min-w-0 text-xs text-gray-500 space-y-0.5">
            {player1StakeTx && (
              <div className="truncate">
                <span>{match.player1.username}: </span>
                <a
                  href={`https://monadscan.com/tx/${player1StakeTx}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--arcade-blue)] hover:text-[var(--accent)] underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {player1StakeTx.slice(0, 6)}...{player1StakeTx.slice(-4)}
                </a>
              </div>
            )}
            {player2StakeTx && (
              <div className="truncate">
                <span>{match.player2.username}: </span>
                <a
                  href={`https://monadscan.com/tx/${player2StakeTx}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--arcade-blue)] hover:text-[var(--accent)] underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {player2StakeTx.slice(0, 6)}...{player2StakeTx.slice(-4)}
                </a>
              </div>
            )}
            {match.payout_tx && winner && (
              <div className="truncate">
                <span>Payout: </span>
                <a
                  href={`https://monadscan.com/tx/${match.payout_tx}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--success)] hover:text-[var(--accent)] underline font-semibold"
                  onClick={(e) => e.stopPropagation()}
                >
                  ${potSize} USDC
                </a>
                <span className="text-gray-600 ml-1">
                  ({match.payout_tx.slice(0, 6)}...{match.payout_tx.slice(-4)})
                </span>
              </div>
            )}
            {!player1StakeTx && !player2StakeTx && !match.payout_tx && (
              <span className="text-gray-600">No transactions</span>
            )}
          </div>

          {isFinished && (
            <a
              href={replayUrl}
              onClick={(e) => e.stopPropagation()}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 border border-[var(--arcade-pink)] bg-[var(--arcade-pink)]/10 text-[var(--arcade-pink)] hover:bg-[var(--arcade-pink)]/25 neon-border-pink transition-all arcade-heading"
              style={{ fontSize: '9px' }}
            >
              <span>&#9654;</span>
              <span>REPLAY</span>
            </a>
          )}
        </div>
        </div>

        {/* Right accent bar (player 2) */}
        <div className={`w-1 flex-shrink-0 ${rightBarColor}`} />
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
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="arcade-heading text-2xl font-bold mb-6 text-[var(--primary)] neon-text-red">All Matches</h1>

      {/* Live Matches */}
      {liveMatches.length > 0 && (
        <section className="mb-8">
          <h2 className="arcade-heading text-sm font-semibold mb-4 flex items-center gap-2 text-[var(--primary)]">
            <span className="w-3 h-3 bg-[var(--primary)] rounded-full animate-pulse" style={{ boxShadow: '0 0 8px var(--primary)' }}></span>
            Live Matches
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {liveMatches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        </section>
      )}

      {/* Past Matches */}
      <section>
        <h2 className="arcade-heading text-sm font-semibold mb-4 text-[var(--accent)]">Recent Matches</h2>
        {loading ? (
          <div className="text-center text-gray-400 py-8">Loading...</div>
        ) : pastMatches.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            No matches found.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {pastMatches.map((match) => (
                <MatchCard key={match.id} match={match} />
              ))}
            </div>

            {/* Pagination */}
            <div className="flex justify-center gap-4 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 bg-[var(--surface)] border-2 border-[var(--border)] disabled:opacity-50 disabled:cursor-not-allowed hover:border-[var(--accent)] hover:neon-border transition-all uppercase text-xs tracking-wider"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-gray-400 font-mono">Page {page}</span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={pastMatches.length < 20}
                className="px-4 py-2 bg-[var(--surface)] border-2 border-[var(--border)] disabled:opacity-50 disabled:cursor-not-allowed hover:border-[var(--accent)] hover:neon-border transition-all uppercase text-xs tracking-wider"
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
