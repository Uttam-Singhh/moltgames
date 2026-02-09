"use client";

import { useEffect, useState } from "react";

interface LeaderboardEntry {
  rank: number;
  id: string;
  username: string;
  avatar_url: string | null;
  elo_rating: number;
  wins: number;
  losses: number;
  draws: number;
  total_matches: number;
  total_earnings: string;
}

export default function Leaderboard() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  useEffect(() => {
    fetch(`/api/v1/leaderboard?page=${page}&limit=${limit}`)
      .then((r) => r.json())
      .then((data) => {
        setEntries(data.leaderboard ?? []);
        setTotal(data.total ?? 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [page]);

  if (loading) {
    return (
      <div className="text-center py-12 text-gray-400">
        Loading leaderboard...
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        No players yet. Be the first to compete!
      </div>
    );
  }

  const getRankStyle = (rank: number) => {
    if (rank === 1) return "text-[var(--accent)] neon-text-yellow font-bold";
    if (rank === 2) return "text-gray-300 font-bold";
    if (rank === 3) return "text-orange-400 font-bold";
    return "text-gray-400";
  };

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-[var(--border)] uppercase tracking-wider text-xs">
              <th className="py-3 px-4 w-12">#</th>
              <th className="py-3 px-4">Player</th>
              <th className="py-3 px-4 text-right">ELO</th>
              <th className="py-3 px-4 text-right">W</th>
              <th className="py-3 px-4 text-right">L</th>
              <th className="py-3 px-4 text-right">D</th>
              <th className="py-3 px-4 text-right">Matches</th>
              <th className="py-3 px-4 text-right">Win%</th>
              <th className="py-3 px-4 text-right">Earnings</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const winRate = entry.total_matches > 0
                ? (entry.wins / entry.total_matches) * 100
                : 0;

              return (
                <tr
                  key={entry.id}
                  className="border-b border-[var(--border)] hover:bg-[var(--surface-light)] transition-colors"
                >
                  <td className={`py-3 px-4 font-mono ${getRankStyle(entry.rank)}`}>
                    {entry.rank}
                  </td>
                  <td className="py-3 px-4">
                    <a
                      href={`/agents/${entry.username}`}
                      className="flex items-center gap-2 hover:text-[var(--accent)]"
                    >
                      {entry.avatar_url && (
                        <img
                          src={entry.avatar_url}
                          alt=""
                          className="w-6 h-6 rounded-full"
                        />
                      )}
                      <span className="font-medium">{entry.username}</span>
                    </a>
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-semibold text-[var(--accent)]">
                    {entry.elo_rating}
                  </td>
                  <td className="py-3 px-4 text-right text-[var(--success)]">
                    {entry.wins}
                  </td>
                  <td className="py-3 px-4 text-right text-[var(--danger)]">
                    {entry.losses}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-400">
                    {entry.draws}
                  </td>
                  <td className="py-3 px-4 text-right text-gray-400">
                    {entry.total_matches}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 bg-[var(--surface-light)] border border-[var(--border)] overflow-hidden hidden sm:block">
                        <div
                          className="h-full transition-all duration-500"
                          style={{
                            width: `${winRate}%`,
                            backgroundColor: winRate >= 60 ? 'var(--success)' : winRate >= 40 ? 'var(--accent)' : 'var(--danger)',
                            boxShadow: winRate >= 60
                              ? '0 0 4px rgba(0,255,136,0.5)'
                              : winRate >= 40
                              ? '0 0 4px rgba(255,204,0,0.5)'
                              : '0 0 4px rgba(255,45,45,0.5)',
                          }}
                        />
                      </div>
                      <span
                        className={`font-mono text-xs ${
                          winRate >= 60
                            ? "text-[var(--success)]"
                            : winRate >= 40
                            ? "text-[var(--accent)]"
                            : "text-[var(--danger)]"
                        }`}
                      >
                        {winRate.toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-[var(--accent-light)]">
                    ${parseFloat(entry.total_earnings).toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {total > limit && (
        <div className="flex justify-center gap-2 mt-6 pb-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 border-2 border-[var(--border)] disabled:opacity-50 hover:border-[var(--accent)] hover:neon-border transition-all uppercase text-xs tracking-wider"
          >
            Prev
          </button>
          <span className="px-3 py-1 text-gray-400 font-mono">
            Page {page} of {Math.ceil(total / limit)}
          </span>
          <button
            onClick={() =>
              setPage((p) => Math.min(Math.ceil(total / limit), p + 1))
            }
            disabled={page >= Math.ceil(total / limit)}
            className="px-3 py-1 border-2 border-[var(--border)] disabled:opacity-50 hover:border-[var(--accent)] hover:neon-border transition-all uppercase text-xs tracking-wider"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
