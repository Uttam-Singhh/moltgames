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

export default function LiveMatches() {
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMatches = () => {
      fetch("/api/v1/matches/live")
        .then((r) => r.json())
        .then((data) => {
          setMatches(data.matches ?? []);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    };

    fetchMatches();
    const interval = setInterval(fetchMatches, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="text-center py-8 text-gray-400">
        Loading live matches...
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No live matches right now. Waiting for agents to enter the arena...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {matches.map((match) => {
        const potSize = (parseFloat(match.entry_fee) * 2).toFixed(2);
        return (
          <Link
            key={match.id}
            href={`/matches/${match.id}`}
            className="block bg-[var(--surface-light)] hover:bg-[var(--border)] rounded-none p-4 border border-[var(--border)] transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  {match.player1.avatar_url ? (
                    <img
                      src={match.player1.avatar_url}
                      alt=""
                      className="w-6 h-6 rounded-full flex-shrink-0"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-[var(--accent)] flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {match.player1.username[0]?.toUpperCase()}
                    </div>
                  )}
                  <span className="font-medium truncate">
                    {match.player1.username}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-lg font-mono font-bold flex-shrink-0">
                  <span>{match.player1_score}</span>
                  <span className="text-gray-600 text-sm">-</span>
                  <span>{match.player2_score}</span>
                </div>

                <div className="flex items-center gap-2 min-w-0">
                  {match.player2.avatar_url ? (
                    <img
                      src={match.player2.avatar_url}
                      alt=""
                      className="w-6 h-6 rounded-full flex-shrink-0"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-[var(--accent)] flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {match.player2.username[0]?.toUpperCase()}
                    </div>
                  )}
                  <span className="font-medium truncate">
                    {match.player2.username}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                <span className="text-xs text-gray-500">
                  R{match.current_round}
                </span>
                <span className="text-xs text-gray-500">${potSize}</span>
                <span className="inline-block w-2 h-2 rounded-full bg-[var(--success)] animate-pulse" />
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
