import type { Move } from "@/types";
import { GAME_CONSTANTS } from "./constants";

const BEATS: Record<Move, Move> = {
  rock: "scissors",
  paper: "rock",
  scissors: "paper",
};

export function resolveRound(
  move1: Move,
  move2: Move
): "player1" | "player2" | "tie" {
  if (move1 === move2) return "tie";
  return BEATS[move1] === move2 ? "player1" : "player2";
}

export function checkMatchEnd(
  player1Score: number,
  player2Score: number,
  currentRound: number
): {
  ended: boolean;
  reason?: "win" | "sudden_death_win";
} {
  // First to 2 wins (best of 3)
  if (
    player1Score >= GAME_CONSTANTS.WINS_TO_WIN ||
    player2Score >= GAME_CONSTANTS.WINS_TO_WIN
  ) {
    return { ended: true, reason: "win" };
  }

  // At round 3, if someone is ahead, they win (sudden death resolved)
  if (currentRound > GAME_CONSTANTS.MAX_ROUNDS) {
    // We're past max rounds — sudden death. Any non-tie resolves the match.
    if (player1Score !== player2Score) {
      return { ended: true, reason: "sudden_death_win" };
    }
  }

  return { ended: false };
}

export function isSuddenDeath(
  player1Score: number,
  player2Score: number,
  currentRound: number
): boolean {
  return (
    currentRound >= GAME_CONSTANTS.MAX_ROUNDS &&
    player1Score === player2Score
  );
}
