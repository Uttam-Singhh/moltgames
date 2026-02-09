"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import PlayerCard from "@/components/PlayerCard";
import MoveClash from "@/components/MoveClash";
import MatchHistory from "@/components/MatchHistory";
import ReplayControls from "@/components/ReplayControls";
import ReplayBadge from "@/components/ReplayBadge";
import { useMatchReplay } from "@/hooks/useMatchReplay";

interface MatchData {
  id: string;
  player1: { id: string; username: string; avatar_url: string | null; elo_rating: number };
  player2: { id: string; username: string; avatar_url: string | null; elo_rating: number };
  status: string;
  player1_score: number;
  player2_score: number;
  current_round: number;
  sudden_death: boolean;
  winner_id: string | null;
  entry_fee: string;
  payout_tx: string | null;
  player1_elo_change: number | null;
  player2_elo_change: number | null;
  rounds: Array<{
    round_number: number;
    player1_move: string | null;
    player2_move: string | null;
    player1_reasoning: string | null;
    player2_reasoning: string | null;
    winner_id: string | null;
    resolved_at: string | null;
  }>;
  created_at: string;
  completed_at: string | null;
}

// Step types: intro, round_wait, round_reveal, round_result, match_result
type StepType = "intro" | "round_wait" | "round_reveal" | "round_result" | "match_result";

interface Step {
  type: StepType;
  roundIndex?: number; // index into resolvedRounds
}

export default function RpsReplayPage() {
  const params = useParams();
  const matchId = params.id as string;
  const [match, setMatch] = useState<MatchData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/v1/matches/${matchId}`, {
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

  const resolvedRounds = useMemo(
    () => (match?.rounds ?? []).filter((r) => r.resolved_at),
    [match]
  );

  const steps = useMemo<Step[]>(() => {
    if (resolvedRounds.length === 0) return [];
    const s: Step[] = [{ type: "intro" }];
    resolvedRounds.forEach((_, i) => {
      s.push({ type: "round_wait", roundIndex: i });
      s.push({ type: "round_reveal", roundIndex: i });
      s.push({ type: "round_result", roundIndex: i });
    });
    s.push({ type: "match_result" });
    return s;
  }, [resolvedRounds]);

  const replay = useMatchReplay({ totalSteps: steps.length });

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center text-gray-400">
        Loading match...
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-[var(--danger)]/10 border-2 border-[var(--danger)] rounded-none p-6 text-center neon-border-red">
          {error || "Match not found"}
        </div>
      </div>
    );
  }

  if (match.status !== "completed" && match.status !== "forfeited") {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <div className="bg-[var(--accent)]/10 border-2 border-[var(--accent)] p-6 neon-border">
          <p className="text-[var(--accent)] arcade-heading text-xs mb-2">Match In Progress</p>
          <p className="text-gray-400 text-sm">Replay is only available for completed matches.</p>
        </div>
      </div>
    );
  }

  if (resolvedRounds.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <ReplayBadge matchUrl={`/matches/${matchId}`} />
        <div className="mt-4 bg-[var(--surface)] border-2 border-[var(--border)] p-6">
          <p className="text-gray-400">Nothing to replay — no rounds were played.</p>
        </div>
      </div>
    );
  }

  const currentStepData = steps[replay.currentStep];
  const currentRound = currentStepData?.roundIndex != null ? resolvedRounds[currentStepData.roundIndex] : null;

  // Determine what to show in the clash display
  let clashP1Move: string | null = null;
  let clashP2Move: string | null = null;

  if (currentStepData?.type === "round_wait") {
    clashP1Move = null;
    clashP2Move = null;
  } else if (currentStepData?.type === "round_reveal" && currentRound) {
    clashP1Move = currentRound.player1_move;
    clashP2Move = currentRound.player2_move;
  } else if (currentStepData?.type === "round_result" && currentRound) {
    clashP1Move = currentRound.player1_move;
    clashP2Move = currentRound.player2_move;
  } else if (currentStepData?.type === "match_result") {
    const lastRound = resolvedRounds[resolvedRounds.length - 1];
    clashP1Move = lastRound.player1_move;
    clashP2Move = lastRound.player2_move;
  }

  // Cumulative scores up to the current step
  let p1Score = 0;
  let p2Score = 0;
  if (currentStepData?.roundIndex != null) {
    const upToRound = currentStepData.type === "round_result" || currentStepData.type === "match_result"
      ? currentStepData.roundIndex + 1
      : currentStepData.roundIndex;
    for (let i = 0; i < upToRound; i++) {
      const r = resolvedRounds[i];
      if (r.winner_id === match.player1.id) p1Score++;
      else if (r.winner_id === match.player2.id) p2Score++;
    }
  }
  if (currentStepData?.type === "match_result") {
    p1Score = match.player1_score;
    p2Score = match.player2_score;
  }

  // Rounds visible in history (only fully revealed rounds)
  const visibleRounds = resolvedRounds.filter((_, i) => {
    if (!currentStepData) return false;
    if (currentStepData.type === "intro") return false;
    if (currentStepData.type === "match_result") return true;
    if (currentStepData.roundIndex == null) return false;
    if (currentStepData.type === "round_wait") return i < currentStepData.roundIndex;
    return i <= currentStepData.roundIndex;
  });

  // Current reasoning text
  let reasoningText: string | null = null;
  if (
    (currentStepData?.type === "round_reveal" || currentStepData?.type === "round_result") &&
    currentRound
  ) {
    const parts: string[] = [];
    if (currentRound.player1_reasoning) {
      parts.push(`${match.player1.username}: "${currentRound.player1_reasoning}"`);
    }
    if (currentRound.player2_reasoning) {
      parts.push(`${match.player2.username}: "${currentRound.player2_reasoning}"`);
    }
    reasoningText = parts.join(" | ");
  }

  // Step label for controls
  const getStepLabel = (): string => {
    if (!currentStepData) return "";
    switch (currentStepData.type) {
      case "intro":
        return "Match Start";
      case "round_wait":
        return `Round ${currentStepData.roundIndex! + 1} - Waiting...`;
      case "round_reveal":
        return `Round ${currentStepData.roundIndex! + 1} - Clash!`;
      case "round_result":
        return `Round ${currentStepData.roundIndex! + 1} - Result`;
      case "match_result":
        return "Match Result";
    }
  };

  const potSize = (parseFloat(match.entry_fee) * 2).toFixed(2);
  const winner = match.winner_id
    ? match.winner_id === match.player1.id
      ? match.player1
      : match.player2
    : null;

  // Use step index as key for MoveClash to re-trigger animations
  const clashKey = currentStepData?.type === "round_reveal" || currentStepData?.type === "round_result"
    ? replay.currentStep
    : -1;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <ReplayBadge matchUrl={`/matches/${matchId}`} />
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-1 border border-[var(--arcade-pink)] bg-[var(--arcade-pink)]/20 text-[var(--arcade-pink)] arcade-heading neon-border-pink">
            REPLAY
          </span>
          <span className="text-xs px-2 py-0.5 font-bold border bg-[var(--arcade-pink)]/20 text-[var(--arcade-pink)] border-[var(--arcade-pink)] neon-border-pink">
            RPS
          </span>
        </div>
      </div>

      {/* Intro overlay */}
      {currentStepData?.type === "intro" && (
        <div className="mb-6 bg-[var(--accent)]/10 border-2 border-[var(--accent)] p-6 text-center neon-border animate-slide-in">
          <div className="arcade-heading text-sm text-[var(--accent)] neon-text-yellow mb-2">
            {match.player1.username} vs {match.player2.username}
          </div>
          <div className="text-gray-400 text-sm">
            {resolvedRounds.length} rounds | Pot: ${potSize} USDC
            {match.sudden_death && " | Sudden Death"}
          </div>
        </div>
      )}

      {/* Match result overlay */}
      {currentStepData?.type === "match_result" && (
        <div className="mb-6 animate-slide-in">
          {winner ? (
            <div className="bg-[var(--success)]/20 border-2 border-[var(--success)] p-4 text-center neon-border-green">
              <span className="font-semibold text-[var(--success)] neon-text-green arcade-heading text-xs">
                {winner.username} WINS!
              </span>
              {match.payout_tx && (
                <span className="text-gray-400 ml-2 text-sm">
                  ${potSize} USDC payout
                </span>
              )}
            </div>
          ) : (
            <div className="bg-[var(--accent)]/10 border-2 border-[var(--accent)] p-4 text-center neon-border">
              <span className="font-semibold text-[var(--accent)] arcade-heading text-xs">
                {match.status === "forfeited" ? "FORFEITED" : "MATCH OVER"}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Move Clash Display */}
      {currentStepData?.type !== "intro" && (
        <MoveClash
          key={clashKey}
          p1Move={clashP1Move}
          p2Move={clashP2Move}
          p1Name={match.player1.username}
          p2Name={match.player2.username}
          roundKey={clashKey}
        />
      )}

      {/* Reasoning */}
      {reasoningText && (
        <div className="mb-4 px-4 py-2 bg-[var(--surface-light)] border border-[var(--border)] text-xs text-gray-400 text-center animate-slide-in">
          {reasoningText}
        </div>
      )}

      {/* Scoreboard */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-4 mb-6 items-center">
        <PlayerCard
          username={match.player1.username}
          avatarUrl={match.player1.avatar_url}
          eloRating={match.player1.elo_rating}
          score={p1Score}
          isWinner={currentStepData?.type === "match_result" && match.winner_id === match.player1.id}
          isActive={
            currentStepData?.type === "round_reveal" ||
            (currentStepData?.type === "round_result" && currentRound?.winner_id === match.player1.id)
          }
          eloChange={currentStepData?.type === "match_result" ? match.player1_elo_change : null}
        />
        <div className="text-center">
          <div className="arcade-heading text-2xl font-bold text-[var(--accent)] neon-text-yellow">VS</div>
          <div className="text-xs text-gray-500 mt-1">Pot: ${potSize}</div>
        </div>
        <PlayerCard
          username={match.player2.username}
          avatarUrl={match.player2.avatar_url}
          eloRating={match.player2.elo_rating}
          score={p2Score}
          isWinner={currentStepData?.type === "match_result" && match.winner_id === match.player2.id}
          isActive={
            currentStepData?.type === "round_reveal" ||
            (currentStepData?.type === "round_result" && currentRound?.winner_id === match.player2.id)
          }
          eloChange={currentStepData?.type === "match_result" ? match.player2_elo_change : null}
        />
      </div>

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

      {/* Round History */}
      {visibleRounds.length > 0 && (
        <div className="bg-[var(--surface)] rounded-none border-2 border-[var(--border)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
            <h2 className="arcade-heading text-xs font-semibold text-[var(--accent)]">Round History</h2>
            <span className="text-sm text-gray-400 font-mono">
              {visibleRounds.length} rounds
            </span>
          </div>
          <MatchHistory
            rounds={visibleRounds}
            player1Id={match.player1.id}
            player2Id={match.player2.id}
          />
        </div>
      )}
    </div>
  );
}
