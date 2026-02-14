"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import PlayerCard from "@/components/PlayerCard";
import TttBoard from "@/components/TttBoard";
import TttMoveHistory from "@/components/TttMoveHistory";
import ReplayControls from "@/components/ReplayControls";
import ReplayBadge from "@/components/ReplayBadge";
import { useMatchReplay } from "@/hooks/useMatchReplay";
import { TTT_CONSTANTS } from "@/lib/constants";

interface TttRoundData {
  round_number: number;
  board: string;
  board_grid: string[][];
  move_count: number;
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
  player1_score: number;
  player2_score: number;
  current_round: number;
  rounds: TttRoundData[];
  entry_fee: string;
  payout_tx: string | null;
  player1_elo_change: number | null;
  player2_elo_change: number | null;
  created_at: string;
  completed_at: string | null;
}

type StepType = "intro" | "round_start" | "move" | "round_result" | "match_result";

interface Step {
  type: StepType;
  roundNumber?: number;
  moveIndex?: number; // index into the round's moves array
  p1Score: number;
  p2Score: number;
}

function getWinningLine(board: string): number[] | undefined {
  for (const [a, b, c] of TTT_CONSTANTS.WIN_LINES) {
    if (board[a] !== "-" && board[a] === board[b] && board[b] === board[c]) {
      return [a, b, c];
    }
  }
  return undefined;
}

function buildBoardAtStep(
  moves: TttRoundData["moves"],
  upToIndex: number
): string {
  const cells = "---------".split("");
  for (let i = 0; i <= upToIndex && i < moves.length; i++) {
    cells[moves[i].position] = moves[i].symbol;
  }
  return cells.join("");
}

export default function TttReplayPage() {
  const params = useParams();
  const matchId = params.id as string;
  const [match, setMatch] = useState<TttMatchData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/v1/ttt/${matchId}`, {
      headers: { Authorization: "Bearer viewer" },
    })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load match");
        return r.json();
      })
      .then((data) => {
        setMatch(data);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [matchId]);

  const steps = useMemo<Step[]>(() => {
    if (!match || match.rounds.length === 0) return [];
    const s: Step[] = [{ type: "intro", p1Score: 0, p2Score: 0 }];

    let cumulativeP1 = 0;
    let cumulativeP2 = 0;

    for (const round of match.rounds) {
      // Round start
      s.push({
        type: "round_start",
        roundNumber: round.round_number,
        p1Score: cumulativeP1,
        p2Score: cumulativeP2,
      });

      // Each move
      round.moves.forEach((_, i) => {
        s.push({
          type: "move",
          roundNumber: round.round_number,
          moveIndex: i,
          p1Score: cumulativeP1,
          p2Score: cumulativeP2,
        });
      });

      // Round result — update cumulative scores
      if (round.winner_id) {
        if (round.winner_id === match.player1.id) {
          cumulativeP1 += TTT_CONSTANTS.POINTS_PER_WIN;
        } else {
          cumulativeP2 += TTT_CONSTANTS.POINTS_PER_WIN;
        }
      } else if (round.is_draw) {
        cumulativeP1 += TTT_CONSTANTS.POINTS_PER_DRAW;
        cumulativeP2 += TTT_CONSTANTS.POINTS_PER_DRAW;
      }

      s.push({
        type: "round_result",
        roundNumber: round.round_number,
        p1Score: cumulativeP1,
        p2Score: cumulativeP2,
      });
    }

    // Match result
    s.push({
      type: "match_result",
      p1Score: cumulativeP1,
      p2Score: cumulativeP2,
    });

    return s;
  }, [match]);

  const replay = useMatchReplay({ totalSteps: steps.length });

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

  if (
    match.status !== "completed" &&
    match.status !== "draw" &&
    match.status !== "forfeited"
  ) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <div className="bg-[var(--accent)]/10 border-2 border-[var(--accent)] p-6 neon-border">
          <p className="text-[var(--accent)] arcade-heading text-xs mb-2">
            Match In Progress
          </p>
          <p className="text-gray-400 text-sm">
            Replay is only available for completed matches.
          </p>
        </div>
      </div>
    );
  }

  const totalMoves = match.rounds.reduce((sum, r) => sum + r.moves.length, 0);
  if (totalMoves === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <ReplayBadge matchUrl={`/ttt/matches/${matchId}`} />
        <div className="mt-4 bg-[var(--surface)] border-2 border-[var(--border)] p-6">
          <p className="text-gray-400">
            Nothing to replay — no moves were made.
          </p>
        </div>
      </div>
    );
  }

  const currentStepData = steps[replay.currentStep];
  const currentRoundNumber = currentStepData?.roundNumber ?? 1;
  const currentRound = match.rounds.find(
    (r) => r.round_number === currentRoundNumber
  );

  // Build the board state for the current step
  let currentBoard = "---------";
  let lastMovePosition: number | undefined;
  let winningLine: number[] | undefined;

  if (
    currentStepData?.type === "move" &&
    currentStepData.moveIndex != null &&
    currentRound
  ) {
    currentBoard = buildBoardAtStep(
      currentRound.moves,
      currentStepData.moveIndex
    );
    lastMovePosition =
      currentRound.moves[currentStepData.moveIndex].position;
  } else if (currentStepData?.type === "round_result" && currentRound) {
    currentBoard = buildBoardAtStep(
      currentRound.moves,
      currentRound.moves.length - 1
    );
    if (currentRound.moves.length > 0) {
      lastMovePosition =
        currentRound.moves[currentRound.moves.length - 1].position;
    }
    winningLine = getWinningLine(currentBoard);
  } else if (currentStepData?.type === "match_result") {
    // Show the final round's board
    const lastRound = match.rounds[match.rounds.length - 1];
    if (lastRound && lastRound.moves.length > 0) {
      currentBoard = buildBoardAtStep(
        lastRound.moves,
        lastRound.moves.length - 1
      );
      lastMovePosition =
        lastRound.moves[lastRound.moves.length - 1].position;
      winningLine = getWinningLine(currentBoard);
    }
  }

  // Current move info
  const currentMove =
    currentStepData?.type === "move" &&
    currentStepData.moveIndex != null &&
    currentRound
      ? currentRound.moves[currentStepData.moveIndex]
      : null;

  const currentMovePlayer = currentMove
    ? currentMove.player_id === match.player1.id
      ? match.player1
      : match.player2
    : null;

  // Visible moves for history (up to current step in current round)
  const visibleMoves =
    currentStepData?.type === "round_start" || currentStepData?.type === "intro"
      ? []
      : currentStepData?.type === "round_result" ||
        currentStepData?.type === "match_result"
      ? currentRound?.moves ?? []
      : currentStepData?.moveIndex != null && currentRound
      ? currentRound.moves.slice(0, currentStepData.moveIndex + 1)
      : [];

  // Step label
  const getStepLabel = (): string => {
    if (!currentStepData) return "";
    switch (currentStepData.type) {
      case "intro":
        return "Match Start";
      case "round_start":
        return `Round ${currentStepData.roundNumber} Start`;
      case "move": {
        if (!currentRound || currentStepData.moveIndex == null) return "";
        const move = currentRound.moves[currentStepData.moveIndex];
        const player =
          move.player_id === match.player1.id
            ? match.player1
            : match.player2;
        return `R${currentStepData.roundNumber} Move ${move.move_number} - ${player.username} (${move.symbol})`;
      }
      case "round_result": {
        if (!currentRound) return "";
        if (currentRound.is_draw) return `Round ${currentStepData.roundNumber} - Draw`;
        const roundWinner = currentRound.winner_id === match.player1.id
          ? match.player1
          : match.player2;
        return `Round ${currentStepData.roundNumber} - ${roundWinner.username} wins`;
      }
      case "match_result":
        return "Final Result";
    }
  };

  const potSize = (parseFloat(match.entry_fee) * 2).toFixed(2);
  const winner = match.winner_id
    ? match.winner_id === match.player1.id
      ? match.player1
      : match.player2
    : null;
  const isDraw = match.status === "draw";

  const displayP1Score = currentStepData?.p1Score ?? 0;
  const displayP2Score = currentStepData?.p2Score ?? 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <ReplayBadge matchUrl={`/ttt/matches/${matchId}`} />
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-1 border border-[var(--arcade-pink)] bg-[var(--arcade-pink)]/20 text-[var(--arcade-pink)] arcade-heading neon-border-pink">
            REPLAY
          </span>
          <span className="text-xs px-2 py-0.5 font-bold border bg-[var(--arcade-blue)]/20 text-[var(--arcade-blue)] border-[var(--arcade-blue)] neon-border-blue">
            TTT
          </span>
        </div>
      </div>

      {/* Intro overlay */}
      {currentStepData?.type === "intro" && (
        <div className="mb-6 bg-[var(--accent)]/10 border-2 border-[var(--accent)] p-6 text-center neon-border animate-slide-in">
          <div className="arcade-heading text-sm text-[var(--accent)] neon-text-yellow mb-2">
            {match.player1.username} (X) vs {match.player2.username} (O)
          </div>
          <div className="text-gray-400 text-sm">
            Best of {TTT_CONSTANTS.MAX_ROUNDS} rounds | {match.rounds.length} rounds played | Pot: ${potSize} USDC
          </div>
        </div>
      )}

      {/* Round start overlay */}
      {currentStepData?.type === "round_start" && (
        <div className="mb-6 bg-[var(--arcade-blue)]/10 border-2 border-[var(--arcade-blue)] p-4 text-center neon-border-blue animate-slide-in">
          <div className="arcade-heading text-xs text-[var(--arcade-blue)] neon-text-blue">
            ROUND {currentStepData.roundNumber}
          </div>
          <div className="text-gray-400 text-sm mt-1">
            Score: {displayP1Score} - {displayP2Score}
          </div>
        </div>
      )}

      {/* Round result overlay */}
      {currentStepData?.type === "round_result" && currentRound && (
        <div className="mb-6 animate-slide-in">
          {currentRound.is_draw ? (
            <div className="bg-[var(--accent)]/10 border-2 border-[var(--accent)] p-4 text-center neon-border">
              <span className="font-semibold text-[var(--accent)] arcade-heading text-xs">
                ROUND {currentStepData.roundNumber} - DRAW
              </span>
              <span className="text-gray-400 ml-2 text-sm">
                Score: {displayP1Score} - {displayP2Score}
              </span>
            </div>
          ) : (
            <div className="bg-[var(--success)]/10 border-2 border-[var(--success)] p-4 text-center neon-border-green">
              <span className="font-semibold text-[var(--success)] arcade-heading text-xs">
                ROUND {currentStepData.roundNumber} -{" "}
                {currentRound.winner_id === match.player1.id
                  ? match.player1.username
                  : match.player2.username}{" "}
                WINS
              </span>
              <span className="text-gray-400 ml-2 text-sm">
                Score: {displayP1Score} - {displayP2Score}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Match result overlay */}
      {currentStepData?.type === "match_result" && (
        <div className="mb-6 animate-slide-in">
          {isDraw ? (
            <div className="bg-[var(--accent)]/10 border-2 border-[var(--accent)] p-4 text-center neon-border">
              <span className="font-semibold text-[var(--accent)] arcade-heading text-xs">
                MATCH DRAW
              </span>
              <span className="text-gray-400 ml-2">- Both players refunded</span>
            </div>
          ) : winner ? (
            <div className="bg-[var(--success)]/10 border-2 border-[var(--success)] p-4 text-center neon-border-green">
              <span className="font-semibold text-[var(--success)] neon-text-green arcade-heading text-xs">
                {winner.username} WINS THE MATCH!
              </span>
              <span className="text-gray-400 ml-2 text-sm">
                {displayP1Score} - {displayP2Score}
              </span>
              {match.payout_tx && (
                <span className="text-gray-400 ml-2 text-sm">
                  | ${potSize} USDC payout
                </span>
              )}
            </div>
          ) : match.status === "forfeited" ? (
            <div className="bg-[var(--danger)]/10 border-2 border-[var(--danger)] p-4 text-center neon-border-red">
              <span className="font-semibold text-[var(--danger)] arcade-heading text-xs">
                FORFEITED
              </span>
            </div>
          ) : null}
        </div>
      )}

      {/* Players */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <div className="text-xs text-gray-500 mb-1 text-center font-mono">
            Player 1 (
            <span className="text-[var(--primary)] neon-text-red">X</span>)
          </div>
          <PlayerCard
            username={match.player1.username}
            avatarUrl={match.player1.avatar_url}
            eloRating={match.player1.elo_rating}
            isWinner={
              currentStepData?.type === "match_result" &&
              match.winner_id === match.player1.id
            }
            isActive={
              currentStepData?.type === "move" &&
              currentMove?.player_id === match.player1.id
            }
            eloChange={
              currentStepData?.type === "match_result"
                ? match.player1_elo_change
                : null
            }
            score={displayP1Score}
          />
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1 text-center font-mono">
            Player 2 (
            <span className="text-[var(--accent)] neon-text-yellow">O</span>)
          </div>
          <PlayerCard
            username={match.player2.username}
            avatarUrl={match.player2.avatar_url}
            eloRating={match.player2.elo_rating}
            isWinner={
              currentStepData?.type === "match_result" &&
              match.winner_id === match.player2.id
            }
            isActive={
              currentStepData?.type === "move" &&
              currentMove?.player_id === match.player2.id
            }
            eloChange={
              currentStepData?.type === "match_result"
                ? match.player2_elo_change
                : null
            }
            score={displayP2Score}
          />
        </div>
      </div>

      {/* Board */}
      <div className="bg-[var(--surface)] border-2 border-[var(--border)] p-6 mb-6 neon-border-blue">
        <TttBoard
          board={currentBoard}
          lastMovePosition={lastMovePosition}
          winningLine={winningLine}
        />
        <div className="text-center mt-4 text-sm text-gray-500 font-mono">
          {currentStepData?.type === "move" &&
          currentStepData.moveIndex != null &&
          currentRound
            ? `Round ${currentStepData.roundNumber} - Move ${currentStepData.moveIndex + 1} of ${currentRound.moves.length}`
            : currentStepData?.type === "round_result" ||
              currentStepData?.type === "match_result"
            ? `${totalMoves} total moves`
            : currentStepData?.type === "round_start"
            ? `Round ${currentStepData.roundNumber}`
            : "Ready"}
          {" | "}Pot: ${potSize} USDC
        </div>
      </div>

      {/* Current move reasoning */}
      {currentMove && currentMovePlayer && currentMove.reasoning && (
        <div className="mb-4 px-4 py-2 bg-[var(--surface-light)] border border-[var(--border)] text-xs text-gray-400 text-center animate-slide-in">
          <span className="font-semibold text-[var(--foreground)]">
            {currentMovePlayer.username}:
          </span>{" "}
          &ldquo;{currentMove.reasoning}&rdquo;
        </div>
      )}

      {/* Replay Controls */}
      <div className="mb-6">
        <ReplayControls
          currentStep={replay.currentStep}
          totalSteps={steps.length}
          isPlaying={replay.isPlaying}
          speed={replay.speed}
          isAtStart={replay.isAtStart}
          isAtEnd={replay.isAtEnd}
          stepLabel={getStepLabel()}
          onTogglePlayPause={replay.togglePlayPause}
          onStepForward={replay.stepForward}
          onStepBack={replay.stepBack}
          onGoToStep={replay.goToStep}
          onSetSpeed={replay.setSpeed}
        />
      </div>

      {/* Move History */}
      {visibleMoves.length > 0 && (
        <div className="bg-[var(--surface)] border-2 border-[var(--border)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <h3 className="arcade-heading text-xs font-semibold text-[var(--arcade-blue)]">
              {currentStepData?.roundNumber
                ? `Round ${currentStepData.roundNumber} Moves`
                : "Move History"}
            </h3>
          </div>
          <div className="p-4 max-h-96 overflow-y-auto">
            <TttMoveHistory
              moves={visibleMoves}
              player1={match.player1}
              player2={match.player2}
            />
          </div>
        </div>
      )}

      {/* Payout Info */}
      {currentStepData?.type === "match_result" && match.payout_tx && (
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
