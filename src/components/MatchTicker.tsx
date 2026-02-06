"use client";

import { useEffect, useState } from "react";

interface MatchResult {
  id: string;
  player1: { id: string; username: string };
  player2: { id: string; username: string };
  player1_score: number;
  player2_score: number;
  winner_id: string | null;
  status: string;
  completed_at: string | null;
}

export default function MatchTicker() {
  const [completedMatches, setCompletedMatches] = useState<MatchResult[]>([]);
  const [liveMatches, setLiveMatches] = useState<MatchResult[]>([]);

  useEffect(() => {
    // Fetch recent completed matches
    fetch("/api/v1/matches/history?limit=15")
      .then((r) => r.json())
      .then((data) => setCompletedMatches(data.matches || []))
      .catch(console.error);

    // Fetch live matches
    fetch("/api/v1/matches/live")
      .then((r) => r.json())
      .then((data) => setLiveMatches(data.matches || []))
      .catch(console.error);

    // Refresh every 5 seconds
    const interval = setInterval(() => {
      fetch("/api/v1/matches/history?limit=15")
        .then((r) => r.json())
        .then((data) => setCompletedMatches(data.matches || []))
        .catch(console.error);

      fetch("/api/v1/matches/live")
        .then((r) => r.json())
        .then((data) => setLiveMatches(data.matches || []))
        .catch(console.error);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const allMatches = [...liveMatches, ...completedMatches];

  if (allMatches.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-black border-t border-[var(--border)] overflow-hidden">
      <div className="ticker-wrapper">
        <div className="ticker-content">
          {/* Duplicate the matches array for seamless loop */}
          {[...allMatches, ...allMatches].map((match, idx) => {
            const isLive = match.status === "in_progress";
            const winner =
              match.winner_id === match.player1.id
                ? match.player1
                : match.winner_id === match.player2.id
                ? match.player2
                : null;

            return (
              <div
                key={`${match.id}-${idx}`}
                className="ticker-item"
              >
                <div className="match-container">
                  {isLive && (
                    <span className="live-badge">LIVE</span>
                  )}
                  {!isLive && <span className="trophy">🏆</span>}
                  <span className="player-name">
                    {winner ? winner.username : match.player1.username}
                  </span>
                  <span className="score">
                    {match.player1_score}–{match.player2_score}
                  </span>
                  <span className="player-name text-gray-400">
                    {winner
                      ? winner.id === match.player1.id
                        ? match.player2.username
                        : match.player1.username
                      : match.player2.username}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        .ticker-wrapper {
          width: 100%;
          overflow: hidden;
          padding: 6px 0;
        }

        .ticker-content {
          display: inline-flex;
          gap: 12px;
          white-space: nowrap;
          animation: scroll 80s linear infinite;
        }

        .ticker-item {
          display: inline-block;
        }

        .match-container {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 6px 16px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 4px;
          font-size: 0.875rem;
        }

        .live-badge {
          background: #dc2626;
          color: white;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 0.7rem;
          font-weight: bold;
        }

        .trophy {
          font-size: 1rem;
        }

        .player-name {
          color: white;
          font-weight: 500;
        }

        .score {
          color: white;
          font-weight: 700;
          font-size: 1.1rem;
          font-family: 'Courier New', monospace;
          letter-spacing: 0.5px;
        }

        @keyframes scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }

        .ticker-content:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}
