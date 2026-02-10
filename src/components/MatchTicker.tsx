"use client";

import { useEffect, useState } from "react";

interface MatchResult {
  id: string;
  game_type?: string;
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
    const fetchAll = () => {
      // Fetch completed matches from all games
      Promise.all([
        fetch("/api/v1/matches/history?limit=10").then((r) => r.json()),
        fetch("/api/v1/ttt/history?limit=10").then((r) => r.json()),
        fetch("/api/v1/tetris/history?limit=10").then((r) => r.json()),
      ])
        .then(([rpsData, tttData, tetrisData]) => {
          const all = [
            ...(rpsData.matches || []),
            ...(tttData.matches || []),
            ...(tetrisData.matches || []),
          ].sort(
            (a: MatchResult, b: MatchResult) =>
              new Date(b.completed_at || b.id).getTime() -
              new Date(a.completed_at || a.id).getTime()
          );
          setCompletedMatches(all.slice(0, 15));
        })
        .catch(console.error);

      // Fetch live matches from all games
      Promise.all([
        fetch("/api/v1/matches/live").then((r) => r.json()),
        fetch("/api/v1/ttt/live").then((r) => r.json()),
        fetch("/api/v1/tetris/live").then((r) => r.json()),
      ])
        .then(([rpsData, tttData, tetrisData]) => {
          setLiveMatches([
            ...(rpsData.matches || []),
            ...(tttData.matches || []),
            ...(tetrisData.matches || []),
          ]);
        })
        .catch(console.error);
    };

    fetchAll();
    const interval = setInterval(fetchAll, 5000);
    return () => clearInterval(interval);
  }, []);

  const allMatches = [...liveMatches, ...completedMatches];

  if (allMatches.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[#08080f] border-t-2 overflow-hidden" style={{ borderImage: 'linear-gradient(90deg, var(--arcade-blue), var(--primary), var(--accent)) 1' }}>
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
            const gameLabel = (match.game_type ?? "rps").toUpperCase();

            return (
              <div
                key={`${match.id}-${idx}`}
                className="ticker-item"
              >
                <div className="match-container">
                  <span className={`game-label ${gameLabel === "TTT" ? "game-label-ttt" : gameLabel === "TETRIS" ? "game-label-tetris" : "game-label-rps"}`}>{gameLabel}</span>
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
                  <span className="player-name loser-name">
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
          animation: scroll 20s linear infinite;
        }

        .ticker-item {
          display: inline-block;
        }

        .match-container {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 6px 16px;
          background: rgba(26, 26, 46, 0.8);
          border: 1px solid rgba(68, 136, 255, 0.2);
          border-radius: 4px;
          font-size: 0.875rem;
        }

        .match-container:hover {
          box-shadow: 0 0 8px rgba(68, 136, 255, 0.3);
        }

        .game-label {
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.05em;
          padding: 1px 5px;
          border-radius: 3px;
        }

        .game-label-rps {
          color: #ff2d2d;
          border: 1px solid rgba(255, 45, 45, 0.4);
        }

        .game-label-ttt {
          color: #4488ff;
          border: 1px solid rgba(68, 136, 255, 0.4);
        }

        .game-label-tetris {
          color: #00e676;
          border: 1px solid rgba(0, 230, 118, 0.4);
        }

        .live-badge {
          background: #ff2d2d;
          color: white;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 0.7rem;
          font-weight: bold;
          box-shadow: 0 0 8px rgba(255, 45, 45, 0.5);
        }

        .trophy {
          font-size: 1.1rem;
          filter: drop-shadow(0 0 4px rgba(255, 204, 0, 0.5));
        }

        .player-name {
          color: white;
          font-weight: 500;
        }

        .loser-name {
          color: #9ca3af;
        }

        .score {
          color: #ffcc00;
          font-weight: 700;
          font-size: 1.1rem;
          font-family: 'Courier New', monospace;
          letter-spacing: 0.5px;
          text-shadow: 0 0 6px rgba(255, 204, 0, 0.4);
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
