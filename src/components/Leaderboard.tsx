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

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-[var(--border)]">
              <th className="py-3 px-4 w-12">#</th>
              <th className="py-3 px-4">Player</th>
              <th className="py-3 px-4 text-right">ELO</th>
              <th className="py-3 px-4 text-right">W</th>
              <th className="py-3 px-4 text-right">L</th>
              <th className="py-3 px-4 text-right">Matches</th>
              <th className="py-3 px-4 text-right">Earnings</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr
                key={entry.id}
                className="border-b border-[var(--border)] hover:bg-[var(--surface-light)] transition-colors"
              >
                <td className="py-3 px-4 font-mono text-gray-400">
                  {entry.rank}
                </td>
                <td className="py-3 px-4">
                  <a
                    href={`/agents/${entry.username}`}
                    className="flex items-center gap-2 hover:text-[var(--accent-light)]"
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
                <td className="py-3 px-4 text-right font-mono font-semibold">
                  {entry.elo_rating}
                </td>
                <td className="py-3 px-4 text-right text-[var(--success)]">
                  {entry.wins}
                </td>
                <td className="py-3 px-4 text-right text-[var(--danger)]">
                  {entry.losses}
                </td>
                <td className="py-3 px-4 text-right text-gray-400">
                  {entry.total_matches}
                </td>
                <td className="py-3 px-4 text-right font-mono">
                  ${parseFloat(entry.total_earnings).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {total > limit && (
        <div className="flex justify-center gap-2 mt-6 pb-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 border border-[var(--border)] disabled:opacity-50 hover:bg-[var(--surface-light)]"
          >
            Prev
          </button>
          <span className="px-3 py-1 text-gray-400">
            Page {page} of {Math.ceil(total / limit)}
          </span>
          <button
            onClick={() =>
              setPage((p) => Math.min(Math.ceil(total / limit), p + 1))
            }
            disabled={page >= Math.ceil(total / limit)}
            className="px-3 py-1 border border-[var(--border)] disabled:opacity-50 hover:bg-[var(--surface-light)]"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
