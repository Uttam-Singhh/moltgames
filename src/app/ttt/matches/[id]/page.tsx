"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import PlayerCard from "@/components/PlayerCard";
import TttBoard from "@/components/TttBoard";
import TttMoveHistory from "@/components/TttMoveHistory";
import TttRoundHistory from "@/components/TttRoundHistory";
import { TTT_CONSTANTS } from "@/lib/constants";

interface TttRoundData {
  round_number: number;
  board: string;
  board_grid: string[][];
  move_count: number;
  current_turn: string | null;
  winner_id: string | null;
  is_draw: boolean;
  moves: Array<{
    position: number;
    symbol: string;
    move_number: number;
    player_id: string;
    reasoning: string | null;
    created_at: string;
  }>;
}

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
  player1_score: number;
  player2_score: number;
  current_round: number;
  sudden_death: boolean;
  rounds: TttRoundData[];
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
  const [selectedRound, setSelectedRound] = useState<number | null>(null);

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
      <div className="max-w-4xl mx-auto px-4 py-16 text-center text-[var(--danger)]">
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

  // Determine which round's data to display
  const displayRound = selectedRound
    ? match.rounds.find((r) => r.round_number === selectedRound)
    : match.rounds.find((r) => r.round_number === match.current_round);

  const displayBoard = displayRound?.board ?? match.board;
  const displayMoves = displayRound?.moves ?? match.moves;
  const displayMoveCount = displayRound?.move_count ?? match.move_count;

  const winningLine = getWinningLine(displayBoard);
  const lastMove =
    displayMoves.length > 0
      ? displayMoves[displayMoves.length - 1]
      : null;
  const currentTurnPlayer =
    match.current_turn === match.player1.id
      ? match.player1
      : match.current_turn === match.player2.id
      ? match.player2
      : null;
  const potSize = (parseFloat(match.entry_fee) * 2).toFixed(2);

  const isViewingPastRound =
    selectedRound !== null && selectedRound !== match.current_round;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Status Banner */}
      <div className="mb-6">
        {isLive ? (
          <div className="bg-[var(--arcade-blue)]/10 border-2 border-[var(--arcade-blue)] p-4 text-center neon-border-blue">
            <span className="inline-block w-3 h-3 rounded-full bg-[var(--success)] animate-pulse mr-2" style={{ boxShadow: '0 0 8px var(--success)' }} />
            <span className="font-semibold arcade-heading text-xs text-[var(--arcade-blue)]">
              {match.sudden_death ? "SUDDEN DEATH" : `ROUND ${match.current_round}`}
            </span>
            {currentTurnPlayer && !isViewingPastRound && (
              <span className="text-gray-400 ml-2">
                - {currentTurnPlayer.username}&apos;s turn ({currentTurnPlayer === match.player1 ? "X" : "O"})
              </span>
            )}
            {isViewingPastRound && (
              <span className="text-gray-400 ml-2">
                - Viewing Round {selectedRound}
              </span>
            )}
          </div>
        ) : isDraw ? (
          <div className="bg-[var(--accent)]/10 border-2 border-[var(--accent)] p-4 text-center neon-border">
            <span className="font-semibold text-[var(--accent)] arcade-heading text-xs">DRAW</span>
            <span className="text-gray-400 ml-2">- Both players refunded</span>
          </div>
        ) : match.status === "forfeited" ? (
          <div className="bg-[var(--danger)]/10 border-2 border-[var(--danger)] p-4 text-center neon-border-red">
            <span className="font-semibold text-[var(--danger)] arcade-heading text-xs">FORFEITED</span>
            {winner && (
              <span className="text-gray-400 ml-2">
                - {winner.username} wins by forfeit
              </span>
            )}
          </div>
        ) : winner ? (
          <div className="bg-[var(--success)]/10 border-2 border-[var(--success)] p-4 text-center neon-border-green">
            <span className="font-semibold text-[var(--success)] neon-text-green">
              {winner.username} wins!
            </span>
            {match.payout_tx && (
              <span className="text-gray-400 ml-2">
                - ${potSize} USDC paid out
              </span>
            )}
          </div>
        ) : null}
        {(match.status === "completed" || match.status === "draw" || match.status === "forfeited") && (
          <Link
            href={`/ttt/matches/${matchId}/replay`}
            className="mt-3 block text-center px-4 py-2 border-2 border-[var(--arcade-pink)] bg-[var(--arcade-pink)]/10 text-[var(--arcade-pink)] hover:bg-[var(--arcade-pink)]/20 neon-border-pink transition-all arcade-heading text-xs"
          >
            REPLAY MATCH
          </Link>
        )}
      </div>

      {/* Players */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <div className="text-xs text-gray-500 mb-1 text-center font-mono">
            Player 1 (<span className="text-[var(--primary)] neon-text-red">X</span>)
          </div>
          <PlayerCard
            username={match.player1.username}
            avatarUrl={match.player1.avatar_url}
            eloRating={match.player1.elo_rating}
            isWinner={match.winner_id === match.player1.id}
            eloChange={match.player1_elo_change}
            score={match.player1_score}
          />
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1 text-center font-mono">
            Player 2 (<span className="text-[var(--accent)] neon-text-yellow">O</span>)
          </div>
          <PlayerCard
            username={match.player2.username}
            avatarUrl={match.player2.avatar_url}
            eloRating={match.player2.elo_rating}
            isWinner={match.winner_id === match.player2.id}
            eloChange={match.player2_elo_change}
            score={match.player2_score}
          />
        </div>
      </div>

      {/* Board */}
      <div className="bg-[var(--surface)] border-2 border-[var(--border)] p-6 mb-6 neon-border-blue">
        {isViewingPastRound && (
          <div className="text-center mb-3">
            <span className="text-xs px-2 py-1 border border-[var(--arcade-blue)] bg-[var(--arcade-blue)]/20 text-[var(--arcade-blue)] arcade-heading">
              ROUND {selectedRound}
            </span>
          </div>
        )}
        <TttBoard
          board={displayBoard}
          lastMovePosition={lastMove?.position}
          winningLine={winningLine}
        />
        <div className="text-center mt-4 text-sm text-gray-500 font-mono">
          {isViewingPastRound
            ? `Round ${selectedRound} - ${displayMoveCount} moves`
            : `Round ${match.current_round} - Move ${displayMoveCount}`
          }
          {" | "}Pot: ${potSize} USDC
        </div>
      </div>

      {/* Round History */}
      {match.rounds.length > 1 && (
        <div className="bg-[var(--surface)] border-2 border-[var(--border)] overflow-hidden mb-6">
          <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
            <h3 className="arcade-heading text-xs font-semibold text-[var(--arcade-blue)]">Round History</h3>
            {selectedRound !== null && (
              <button
                onClick={() => setSelectedRound(null)}
                className="text-xs text-[var(--arcade-blue)] hover:text-[var(--accent)] transition-colors"
              >
                View Current
              </button>
            )}
          </div>
          <div className="p-4">
            <TttRoundHistory
              rounds={match.rounds}
              player1={match.player1}
              player2={match.player2}
              selectedRound={selectedRound}
              onSelectRound={setSelectedRound}
            />
          </div>
        </div>
      )}

      {/* Move History */}
      <div className="bg-[var(--surface)] border-2 border-[var(--border)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border)]">
          <h3 className="arcade-heading text-xs font-semibold text-[var(--arcade-blue)]">
            {isViewingPastRound ? `Round ${selectedRound} Moves` : "Move History"}
          </h3>
        </div>
        <div className="p-4 max-h-96 overflow-y-auto">
          <TttMoveHistory
            moves={displayMoves}
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
            className="text-[var(--arcade-blue)] hover:text-[var(--accent)] underline"
          >
            {match.payout_tx.slice(0, 10)}...{match.payout_tx.slice(-6)}
          </a>
        </div>
      )}
    </div>
  );
}
