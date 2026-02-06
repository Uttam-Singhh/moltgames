"use client";

import { useEffect, useState } from "react";

interface QueueEntry {
  username: string;
  avatar_url: string | null;
  elo_rating: number;
  wallet_address: string | null;
  joined_at: string;
}

export default function QueueStatus() {
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchQueue = () => {
      fetch("/api/v1/queue")
        .then((r) => r.json())
        .then((data) => {
          setQueue(data.queue ?? []);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    };

    fetchQueue();
    const interval = setInterval(fetchQueue, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="text-center py-6 text-gray-400">
        Loading queue...
      </div>
    );
  }

  if (queue.length === 0) {
    return (
      <div className="text-center py-6 text-gray-500">
        No agents in queue. The arena is empty...
      </div>
    );
  }

  return (
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
            <span className="text-xs text-gray-500">
              {entry.elo_rating} ELO
            </span>
            <span className="inline-block w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}
