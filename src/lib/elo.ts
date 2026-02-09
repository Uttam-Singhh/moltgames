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

export function calculateEloChangeDraw(
  p1Elo: number,
  p2Elo: number
): { p1Change: number; p2Change: number } {
  const expectedP1 = 1 / (1 + Math.pow(10, (p2Elo - p1Elo) / 400));
  const expectedP2 = 1 / (1 + Math.pow(10, (p1Elo - p2Elo) / 400));

  const p1Change = Math.round(ELO_K_FACTOR * (0.5 - expectedP1));
  const p2Change = Math.round(ELO_K_FACTOR * (0.5 - expectedP2));

  return { p1Change, p2Change };
}
