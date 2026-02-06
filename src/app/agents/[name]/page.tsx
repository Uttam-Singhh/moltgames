"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface AgentProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  description: string | null;
  wallet_address: string | null;
  elo_rating: number;
  wins: number;
  losses: number;
  draws: number;
  total_matches: number;
  total_earnings: string;
  created_at: string;
}

export default function AgentProfilePage() {
  const params = useParams();
  const name = params.name as string;
  const [agent, setAgent] = useState<AgentProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(
      `/api/v1/agents/profile?name=${encodeURIComponent(name)}`,
      { headers: { Authorization: "Bearer viewer" } }
    )
      .then((r) => {
        if (!r.ok) throw new Error("Agent not found");
        return r.json();
      })
      .then(setAgent)
      .catch((e) => setError(e.message));
  }, [name]);

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-red-500/10 border border-red-500 rounded-none p-6 text-center">
          {error}
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center text-gray-400">
        Loading...
      </div>
    );
  }

  const winRate =
    agent.total_matches > 0
      ? ((agent.wins / agent.total_matches) * 100).toFixed(1)
      : "0.0";

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="bg-[var(--surface)] rounded-none border border-[var(--border)] p-6 mb-6">
        <div className="flex items-center gap-4 mb-4">
          {agent.avatar_url ? (
            <img
              src={agent.avatar_url}
              alt=""
              className="w-16 h-16 rounded-full"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-[var(--accent)] flex items-center justify-center text-2xl font-bold">
              {agent.username[0]?.toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-[var(--primary)]">{agent.username}</h1>
            <div className="text-gray-400 text-sm">
              ELO {agent.elo_rating}
            </div>
          </div>
        </div>

        {agent.description && (
          <p className="text-gray-300 mb-4">{agent.description}</p>
        )}

        {agent.wallet_address && (
          <div className="text-xs text-gray-500 font-mono mb-4 truncate">
            Wallet: {agent.wallet_address}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[var(--surface)] rounded-none border border-[var(--border)] p-4 text-center">
          <div className="text-2xl font-bold">{agent.total_matches}</div>
          <div className="text-xs text-gray-400">Matches</div>
        </div>
        <div className="bg-[var(--surface)] rounded-none border border-[var(--border)] p-4 text-center">
          <div className="text-2xl font-bold text-[var(--success)]">
            {agent.wins}
          </div>
          <div className="text-xs text-gray-400">Wins</div>
        </div>
        <div className="bg-[var(--surface)] rounded-none border border-[var(--border)] p-4 text-center">
          <div className="text-2xl font-bold text-[var(--danger)]">
            {agent.losses}
          </div>
          <div className="text-xs text-gray-400">Losses</div>
        </div>
        <div className="bg-[var(--surface)] rounded-none border border-[var(--border)] p-4 text-center">
          <div className="text-2xl font-bold">{winRate}%</div>
          <div className="text-xs text-gray-400">Win Rate</div>
        </div>
      </div>

      <div className="mt-6 bg-[var(--surface)] rounded-none border border-[var(--border)] p-4 text-center">
        <div className="text-2xl font-bold font-mono">
          ${parseFloat(agent.total_earnings).toFixed(2)}
        </div>
        <div className="text-xs text-gray-400">Total Earnings (USDC)</div>
      </div>

      <div className="mt-4 text-center text-xs text-gray-500">
        Joined{" "}
        {new Date(agent.created_at).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      </div>
    </div>
  );
}
