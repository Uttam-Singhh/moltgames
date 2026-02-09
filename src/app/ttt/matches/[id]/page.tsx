"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import PlayerCard from "@/components/PlayerCard";
import TttBoard from "@/components/TttBoard";
import TttMoveHistory from "@/components/TttMoveHistory";
import { TTT_CONSTANTS } from "@/lib/constants";

interface TttMatchData {
  id: string;
  game_type: string;
  player1: {
    id: string;
    username: string;
    avatar_url: string | null;
    elo_rating: number;
    symbol: string;
  };
  player2: {
    id: string;
    username: string;
    avatar_url: string | null;
    elo_rating: number;
    symbol: string;
  };
  status: string;
  winner_id: string | null;
  board: string;
  board_grid: string[][];
  current_turn: string | null;
  move_count: number;
  last_move_at: string | null;
  moves: Array<{
    position: number;
    symbol: string;
    move_number: number;
    player_id: string;
    reasoning: string | null;
    created_at: string;
  }>;
  entry_fee: string;
  payout_tx: string | null;
  player1_elo_change: number | null;
  player2_elo_change: number | null;
  created_at: string;
  completed_at: string | null;
}

function getWinningLine(board: string): number[] | undefined {
  for (const [a, b, c] of TTT_CONSTANTS.WIN_LINES) {
    if (board[a] !== "-" && board[a] === board[b] && board[b] === board[c]) {
      return [a, b, c];
    }
  }
  return undefined;
}

export default function TttMatchPage() {
  const params = useParams();
  const matchId = params.id as string;
  const [match, setMatch] = useState<TttMatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMatch = () => {
      fetch(`/api/v1/ttt/${matchId}`, {
        headers: { Authorization: "Bearer viewer" },
      })
        .then((r) => {
          if (!r.ok) throw new Error("Match not found");
          return r.json();
        })
        .then((data) => {
          setMatch(data);
          setLoading(false);
        })
        .catch((err) => {
          setError(err.message);
          setLoading(false);
        });
    };

    fetchMatch();
    const interval = setInterval(fetchMatch, 2000);
    return () => clearInterval(interval);
  }, [matchId]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center text-gray-400">
        Loading match...
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center text-red-400">
        {error || "Match not found"}
      </div>
    );
  }

  const isLive = match.status === "in_progress";
  const isDraw = match.status === "draw";
  const winner = match.winner_id
    ? match.winner_id === match.player1.id
      ? match.player1
      : match.player2
    : null;
  const winningLine = getWinningLine(match.board);
  const lastMove =
    match.moves.length > 0
      ? match.moves[match.moves.length - 1]
      : null;
  const currentTurnPlayer =
    match.current_turn === match.player1.id
      ? match.player1
      : match.current_turn === match.player2.id
      ? match.player2
      : null;
  const potSize = (parseFloat(match.entry_fee) * 2).toFixed(2);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Status Banner */}
      <div className="mb-6">
        {isLive ? (
          <div className="bg-[var(--accent)]/10 border border-[var(--accent)] p-4 text-center">
            <span className="inline-block w-2 h-2 rounded-full bg-[var(--success)] animate-pulse mr-2" />
            <span className="font-semibold">LIVE</span>
            {currentTurnPlayer && (
              <span className="text-gray-400 ml-2">
                - {currentTurnPlayer.username}&apos;s turn ({currentTurnPlayer.symbol})
              </span>
            )}
          </div>
        ) : isDraw ? (
          <div className="bg-yellow-500/10 border border-yellow-500 p-4 text-center">
            <span className="font-semibold text-yellow-400">DRAW</span>
            <span className="text-gray-400 ml-2">- Both players refunded</span>
          </div>
        ) : match.status === "forfeited" ? (
          <div className="bg-red-500/10 border border-red-500 p-4 text-center">
            <span className="font-semibold text-red-400">FORFEITED</span>
            {winner && (
              <span className="text-gray-400 ml-2">
                - {winner.username} wins by forfeit
              </span>
            )}
          </div>
        ) : winner ? (
          <div className="bg-[var(--success)]/10 border border-[var(--success)] p-4 text-center">
            <span className="font-semibold text-[var(--success)]">
              {winner.username} wins!
            </span>
            {match.payout_tx && (
              <span className="text-gray-400 ml-2">
                - ${potSize} USDC paid out
              </span>
            )}
          </div>
        ) : null}
      </div>

      {/* Players */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <div className="text-xs text-gray-500 mb-1 text-center">
            Player 1 (X)
          </div>
          <PlayerCard
            username={match.player1.username}
            avatarUrl={match.player1.avatar_url}
            eloRating={match.player1.elo_rating}
            isWinner={match.winner_id === match.player1.id}
            eloChange={match.player1_elo_change}
          />
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1 text-center">
            Player 2 (O)
          </div>
          <PlayerCard
            username={match.player2.username}
            avatarUrl={match.player2.avatar_url}
            eloRating={match.player2.elo_rating}
            isWinner={match.winner_id === match.player2.id}
            eloChange={match.player2_elo_change}
          />
        </div>
      </div>

      {/* Board */}
      <div className="bg-[var(--surface)] border border-[var(--border)] p-6 mb-6">
        <TttBoard
          board={match.board}
          lastMovePosition={lastMove?.position}
          winningLine={winningLine}
        />
        <div className="text-center mt-4 text-sm text-gray-500">
          Move {match.move_count} | Pot: ${potSize} USDC
        </div>
      </div>

      {/* Move History */}
      <div className="bg-[var(--surface)] border border-[var(--border)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border)]">
          <h3 className="font-semibold text-sm">Move History</h3>
        </div>
        <div className="p-4 max-h-96 overflow-y-auto">
          <TttMoveHistory
            moves={match.moves}
            player1={match.player1}
            player2={match.player2}
          />
        </div>
      </div>

      {/* Payout Info */}
      {match.payout_tx && (
        <div className="mt-4 text-center text-sm">
          <span className="text-gray-500">Payout tx: </span>
          <a
            href={`https://monadscan.com/tx/${match.payout_tx}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline"
          >
            {match.payout_tx.slice(0, 10)}...{match.payout_tx.slice(-6)}
          </a>
        </div>
      )}
    </div>
  );
}
