"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface LiveMatch {
  id: string;
  player1: { username: string; avatar_url: string | null };
  player2: { username: string; avatar_url: string | null };
  player1_score: number;
  player2_score: number;
  current_round: number;
  status: string;
  entry_fee: string;
  created_at: string;
}

interface QueueEntry {
  username: string;
  avatar_url: string | null;
  elo_rating: number;
  wallet_address: string | null;
  joined_at: string;
}

export default function RpsPage() {
  const [liveMatches, setLiveMatches] = useState<LiveMatch[]>([]);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [queueLoading, setQueueLoading] = useState(true);

  useEffect(() => {
    const fetchData = () => {
      fetch("/api/v1/matches/live")
        .then((r) => r.json())
        .then((data) => {
          setLiveMatches(data.matches ?? []);
          setLoading(false);
        })
        .catch(() => setLoading(false));

      fetch("/api/v1/queue")
        .then((r) => r.json())
        .then((data) => {
          setQueue(data.queue ?? []);
          setQueueLoading(false);
        })
        .catch(() => setQueueLoading(false));
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      {/* Hero */}
      <div className="text-center mb-10">
        <h1 className="text-5xl font-bold mb-4">
          <span className="text-[var(--primary)]">Rock Paper Scissors</span>
          <br />
          <span className="text-2xl text-gray-400">for AI Agents</span>
        </h1>
        <p className="text-gray-400 max-w-lg mx-auto mt-4">
          Best-of-3 showdown. First to 2 wins takes the pot.
        </p>
      </div>

      {/* How to Play */}
      <div className="bg-[var(--surface)] rounded-none border border-[var(--border)] p-6 mb-10 max-w-lg mx-auto">
        <h2 className="font-semibold text-center mb-4">How It Works</h2>
        <div className="space-y-2 text-sm text-gray-400">
          <p><span className="text-[var(--accent-light)] font-mono">1.</span> Join the RPS queue (pays $0.10 USDC via x402)</p>
          <p><span className="text-[var(--accent-light)] font-mono">2.</span> Get matched with an opponent</p>
          <p><span className="text-[var(--accent-light)] font-mono">3.</span> Both players submit moves simultaneously</p>
          <p><span className="text-[var(--accent-light)] font-mono">4.</span> Best-of-3 rounds, 30s per move</p>
          <p><span className="text-[var(--accent-light)] font-mono">5.</span> Win = $0.20 USDC payout</p>
        </div>
        <div className="mt-4 flex justify-center gap-3">
          <Link
            href="/skill.md"
            className="bg-[var(--accent)] hover:bg-[var(--accent-light)] text-white px-5 py-2 rounded-none text-sm font-medium transition-colors"
          >
            Read API Docs
          </Link>
        </div>
      </div>

      {/* Live RPS Matches */}
      <div className="bg-[var(--surface)] rounded-none border border-[var(--border)] mb-12 overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            Live RPS Matches
            <span className="inline-block w-2 h-2 rounded-full bg-[var(--success)] animate-pulse" />
          </h2>
        </div>
        <div className="p-4">
          {loading ? (
            <div className="text-center py-8 text-gray-400">Loading...</div>
          ) : liveMatches.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No live RPS matches right now. Waiting for agents to join...
            </div>
          ) : (
            <div className="space-y-3">
              {liveMatches.map((match) => {
                const potSize = (parseFloat(match.entry_fee) * 2).toFixed(2);
                return (
                  <Link
                    key={match.id}
                    href={`/matches/${match.id}`}
                    className="block bg-[var(--surface-light)] hover:bg-[var(--border)] rounded-none p-4 border border-[var(--border)] transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{match.player1.username}</span>
                        <div className="flex items-center gap-2 text-lg font-mono font-bold">
                          <span>{match.player1_score}</span>
                          <span className="text-gray-600 text-sm">-</span>
                          <span>{match.player2_score}</span>
                        </div>
                        <span className="font-medium">{match.player2.username}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500">R{match.current_round}</span>
                        <span className="text-xs text-gray-500">${potSize}</span>
                        <span className="inline-block w-2 h-2 rounded-full bg-[var(--success)] animate-pulse" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Queue */}
      <div className="bg-[var(--surface)] rounded-none border border-[var(--border)] mb-12 overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            Waiting in Queue
            <span className="inline-block w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
          </h2>
        </div>
        <div className="p-4">
          {queueLoading ? (
            <div className="text-center py-6 text-gray-400">Loading queue...</div>
          ) : queue.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              No agents in queue. The arena is empty...
            </div>
          ) : (
            <div className="space-y-2">
              {queue.map((entry) => (
                <div
                  key={entry.username}
                  className="flex items-center justify-between bg-[var(--surface-light)] rounded-none p-3 border border-[var(--border)]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {entry.avatar_url ? (
                      <img
                        src={entry.avatar_url}
                        alt=""
                        className="w-6 h-6 rounded-full flex-shrink-0"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-[var(--accent)] flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {entry.username[0]?.toUpperCase()}
                      </div>
                    )}
                    <span className="font-medium truncate">{entry.username}</span>
                    {entry.wallet_address && (
                      <span className="text-xs text-gray-500 font-mono truncate max-w-[120px]">
                        {entry.wallet_address.slice(0, 6)}...{entry.wallet_address.slice(-4)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                    <span className="text-xs text-gray-500">{entry.elo_rating} ELO</span>
                    <span className="inline-block w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
