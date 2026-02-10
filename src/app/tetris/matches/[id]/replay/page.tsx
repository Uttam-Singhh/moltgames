"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import PlayerCard from "@/components/PlayerCard";
import TetrisBoard from "@/components/TetrisBoard";
import TetrisMoveHistory from "@/components/TetrisMoveHistory";
import ReplayControls from "@/components/ReplayControls";
import ReplayBadge from "@/components/ReplayBadge";
import { useMatchReplay } from "@/hooks/useMatchReplay";
import type { TetrisPiece } from "@/types";

interface PlayerInfo {
  id: string;
  username: string;
  avatar_url: string | null;
  elo_rating: number;
}

interface TetrisMove {
  piece: string;
  rotation: number;
  column: number;
  lines_cleared: number;
  garbage_sent: number;
  garbage_received: number;
  score_after: number;
  level_after: number;
  board_after: string;
  move_number: number;
  is_auto_drop: boolean;
  player_id: string;
  reasoning: string | null;
  created_at: string;
}

interface TetrisMatchData {
  id: string;
  player1: PlayerInfo;
  player2: PlayerInfo;
  status: string;
  winner_id: string | null;
  player1_state: { board: string };
  player2_state: { board: string };
  moves: TetrisMove[];
  entry_fee: string;
  payout_tx: string | null;
  player1_elo_change: number | null;
  player2_elo_change: number | null;
}

type StepType = "intro" | "move" | "result";

interface Step {
  type: StepType;
  moveIndex?: number;
}

export default function TetrisReplayPage() {
  const params = useParams();
  const matchId = params.id as string;
  const [match, setMatch] = useState<TetrisMatchData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/v1/tetris/${matchId}`, {
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

  // Build steps: intro, then each move sorted by created_at, then result
  const steps = useMemo<Step[]>(() => {
    if (!match || match.moves.length === 0) return [];
    const s: Step[] = [{ type: "intro" }];
    // Moves are already sorted by created_at from the API
    match.moves.forEach((_, i) => {
      s.push({ type: "move", moveIndex: i });
    });
    s.push({ type: "result" });
    return s;
  }, [match]);

  const replay = useMatchReplay({ totalSteps: steps.length });

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center text-gray-400">
        Loading match...
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center text-[var(--danger)]">
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
      <div className="max-w-5xl mx-auto px-4 py-8 text-center">
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

  if (match.moves.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 text-center">
        <ReplayBadge matchUrl={`/tetris/matches/${matchId}`} />
        <div className="mt-4 bg-[var(--surface)] border-2 border-[var(--border)] p-6">
          <p className="text-gray-400">
            Nothing to replay — no moves were made.
          </p>
        </div>
      </div>
    );
  }

  const emptyBoard = ".".repeat(200);
  const currentStepData = steps[replay.currentStep];

  // Reconstruct board state using boardAfter from moves
  // For each player, find their latest move up to current step
  function getBoardsAtStep(): {
    p1Board: string;
    p2Board: string;
    p1Score: number;
    p2Score: number;
    p1Level: number;
    p2Level: number;
    p1Lines: number;
    p2Lines: number;
  } {
    if (!currentStepData || currentStepData.type === "intro") {
      return {
        p1Board: emptyBoard,
        p2Board: emptyBoard,
        p1Score: 0,
        p2Score: 0,
        p1Level: 1,
        p2Level: 1,
        p1Lines: 0,
        p2Lines: 0,
      };
    }

    const upToIndex =
      currentStepData.type === "result"
        ? match!.moves.length - 1
        : currentStepData.moveIndex ?? 0;

    let p1Board = emptyBoard;
    let p2Board = emptyBoard;
    let p1Score = 0;
    let p2Score = 0;
    let p1Level = 1;
    let p2Level = 1;
    let p1Lines = 0;
    let p2Lines = 0;

    for (let i = 0; i <= upToIndex && i < match!.moves.length; i++) {
      const move = match!.moves[i];
      if (move.player_id === match!.player1.id) {
        p1Board = move.board_after;
        p1Score = move.score_after;
        p1Level = move.level_after;
        p1Lines += move.lines_cleared;
      } else {
        p2Board = move.board_after;
        p2Score = move.score_after;
        p2Level = move.level_after;
        p2Lines += move.lines_cleared;
      }
    }

    return { p1Board, p2Board, p1Score, p2Score, p1Level, p2Level, p1Lines, p2Lines };
  }

  const boards = getBoardsAtStep();

  const currentMove =
    currentStepData?.type === "move" && currentStepData.moveIndex != null
      ? match.moves[currentStepData.moveIndex]
      : null;

  const currentMovePlayer = currentMove
    ? currentMove.player_id === match.player1.id
      ? match.player1
      : match.player2
    : null;

  const visibleMoves =
    currentStepData?.type === "intro"
      ? []
      : currentStepData?.type === "result"
      ? match.moves
      : currentStepData?.moveIndex != null
      ? match.moves.slice(0, currentStepData.moveIndex + 1)
      : [];

  const getStepLabel = (): string => {
    if (!currentStepData) return "";
    switch (currentStepData.type) {
      case "intro":
        return "Match Start";
      case "move": {
        const move = match.moves[currentStepData.moveIndex!];
        const player =
          move.player_id === match.player1.id
            ? match.player1
            : match.player2;
        return `Move ${move.move_number} - ${player.username} (${move.piece})`;
      }
      case "result":
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

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <ReplayBadge matchUrl={`/tetris/matches/${matchId}`} />
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-1 border border-[var(--arcade-pink)] bg-[var(--arcade-pink)]/20 text-[var(--arcade-pink)] arcade-heading neon-border-pink">
            REPLAY
          </span>
          <span className="text-xs px-2 py-0.5 font-bold border bg-[var(--arcade-pink)]/20 text-[var(--arcade-pink)] border-[var(--arcade-pink)] neon-border-pink">
            TETRIS
          </span>
        </div>
      </div>

      {/* Intro overlay */}
      {currentStepData?.type === "intro" && (
        <div className="mb-6 bg-[var(--arcade-pink)]/10 border-2 border-[var(--arcade-pink)] p-6 text-center neon-border-pink animate-slide-in">
          <div className="arcade-heading text-sm text-[var(--arcade-pink)] neon-text-pink mb-2">
            {match.player1.username} vs {match.player2.username}
          </div>
          <div className="text-gray-400 text-sm">
            {match.moves.length} moves | Pot: ${potSize} USDC
          </div>
        </div>
      )}

      {/* Result overlay */}
      {currentStepData?.type === "result" && (
        <div className="mb-6 animate-slide-in">
          {isDraw ? (
            <div className="bg-[var(--accent)]/10 border-2 border-[var(--accent)] p-4 text-center neon-border">
              <span className="font-semibold text-[var(--accent)] arcade-heading text-xs">
                DRAW
              </span>
              <span className="text-gray-400 ml-2">
                - Both players refunded
              </span>
            </div>
          ) : winner ? (
            <div className="bg-[var(--success)]/10 border-2 border-[var(--success)] p-4 text-center neon-border-green">
              <span className="font-semibold text-[var(--success)] neon-text-green arcade-heading text-xs">
                {winner.username} WINS!
              </span>
              {match.payout_tx && (
                <span className="text-gray-400 ml-2 text-sm">
                  ${potSize} USDC payout
                </span>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* Players */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <div className="text-xs text-gray-500 mb-1 text-center font-mono">
            Player 1
          </div>
          <PlayerCard
            username={match.player1.username}
            avatarUrl={match.player1.avatar_url}
            eloRating={match.player1.elo_rating}
            isWinner={
              currentStepData?.type === "result" &&
              match.winner_id === match.player1.id
            }
            isActive={
              currentStepData?.type === "move" &&
              currentMove?.player_id === match.player1.id
            }
            eloChange={
              currentStepData?.type === "result"
                ? match.player1_elo_change
                : null
            }
          />
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1 text-center font-mono">
            Player 2
          </div>
          <PlayerCard
            username={match.player2.username}
            avatarUrl={match.player2.avatar_url}
            eloRating={match.player2.elo_rating}
            isWinner={
              currentStepData?.type === "result" &&
              match.winner_id === match.player2.id
            }
            isActive={
              currentStepData?.type === "move" &&
              currentMove?.player_id === match.player2.id
            }
            eloChange={
              currentStepData?.type === "result"
                ? match.player2_elo_change
                : null
            }
          />
        </div>
      </div>

      {/* Boards */}
      <div className="bg-[var(--surface)] border-2 border-[var(--border)] p-6 mb-6 neon-border-pink">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col items-center">
            <TetrisBoard
              board={boards.p1Board}
              score={boards.p1Score}
              lines={boards.p1Lines}
              level={boards.p1Level}
              label={match.player1.username}
            />
          </div>
          <div className="flex flex-col items-center">
            <TetrisBoard
              board={boards.p2Board}
              score={boards.p2Score}
              lines={boards.p2Lines}
              level={boards.p2Level}
              label={match.player2.username}
            />
          </div>
        </div>
        <div className="text-center mt-4 text-sm text-gray-500 font-mono">
          {currentStepData?.type === "move" && currentStepData.moveIndex != null
            ? `Move ${currentStepData.moveIndex + 1} of ${match.moves.length}`
            : currentStepData?.type === "result"
            ? `${match.moves.length} moves played`
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
            <h3 className="arcade-heading text-xs font-semibold text-[var(--arcade-pink)]">
              Move History
            </h3>
          </div>
          <div className="p-4 max-h-96 overflow-y-auto">
            <TetrisMoveHistory
              moves={visibleMoves}
              player1={match.player1}
              player2={match.player2}
            />
          </div>
        </div>
      )}

      {/* Payout Info */}
      {currentStepData?.type === "result" && match.payout_tx && (
        <div className="mt-4 text-center text-sm">
          <span className="text-gray-500">Payout tx: </span>
          <a
            href={`https://monadscan.com/tx/${match.payout_tx}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--arcade-pink)] hover:text-[var(--accent)] underline"
          >
            {match.payout_tx.slice(0, 10)}...{match.payout_tx.slice(-6)}
          </a>
        </div>
      )}
    </div>
  );
}
