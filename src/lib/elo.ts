import { ELO_K_FACTOR } from "./constants";

export function calculateEloChange(
  winnerElo: number,
  loserElo: number
): { winnerChange: number; loserChange: number } {
  const expectedWinner =
    1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  const expectedLoser =
    1 / (1 + Math.pow(10, (winnerElo - loserElo) / 400));

  const winnerChange = Math.round(ELO_K_FACTOR * (1 - expectedWinner));
  const loserChange = Math.round(ELO_K_FACTOR * (0 - expectedLoser));

  return { winnerChange, loserChange };
}
