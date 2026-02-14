import { TTT_CONSTANTS } from "./constants";

export type TttSymbol = "X" | "O";

export function isValidMove(board: string, position: number): boolean {
  return position >= 0 && position < 9 && board[position] === "-";
}

export function applyMove(
  board: string,
  position: number,
  symbol: TttSymbol
): string {
  return board.substring(0, position) + symbol + board.substring(position + 1);
}

export function checkWinner(board: string): TttSymbol | null {
  for (const [a, b, c] of TTT_CONSTANTS.WIN_LINES) {
    if (board[a] !== "-" && board[a] === board[b] && board[b] === board[c]) {
      return board[a] as TttSymbol;
    }
  }
  return null;
}

export function isBoardFull(board: string): boolean {
  return !board.includes("-");
}

export function checkTttGameEnd(board: string): {
  ended: boolean;
  winner: TttSymbol | null;
  isDraw: boolean;
} {
  const winner = checkWinner(board);
  if (winner) {
    return { ended: true, winner, isDraw: false };
  }
  if (isBoardFull(board)) {
    return { ended: true, winner: null, isDraw: true };
  }
  return { ended: false, winner: null, isDraw: false };
}

export function boardToGrid(board: string): string[][] {
  return [
    [board[0], board[1], board[2]],
    [board[3], board[4], board[5]],
    [board[6], board[7], board[8]],
  ];
}

export function checkTttMatchEnd(
  p1Score: number,
  p2Score: number,
  currentRound: number
): {
  ended: boolean;
  reason?: "win" | "sudden_death_win";
} {
  // First to POINTS_TO_WIN (4) wins
  if (
    p1Score >= TTT_CONSTANTS.POINTS_TO_WIN ||
    p2Score >= TTT_CONSTANTS.POINTS_TO_WIN
  ) {
    return { ended: true, reason: "win" };
  }

  // Past max rounds — sudden death. Any score difference resolves the match.
  if (currentRound > TTT_CONSTANTS.MAX_ROUNDS) {
    if (p1Score !== p2Score) {
      return { ended: true, reason: "sudden_death_win" };
    }
  }

  return { ended: false };
}

export function isTttSuddenDeath(
  p1Score: number,
  p2Score: number,
  currentRound: number
): boolean {
  return (
    currentRound >= TTT_CONSTANTS.MAX_ROUNDS && p1Score === p2Score
  );
}
