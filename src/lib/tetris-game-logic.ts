import { TETRIS_CONSTANTS } from "./constants";
import type { TetrisPiece } from "@/types";

const { BOARD_WIDTH, BOARD_HEIGHT, PIECES, SCORING, GARBAGE, LINES_PER_LEVEL, BASE_GRAVITY_SECONDS, REDUCTION_PER_LEVEL, MIN_GRAVITY_SECONDS } = TETRIS_CONSTANTS;

// ── Deterministic PRNG (mulberry32) ────────────────────────────────────

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

export function createSeededRng(seed: string): () => number {
  let state = hashSeed(seed);
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── 7-Bag Randomizer ───────────────────────────────────────────────────

const ALL_PIECES: TetrisPiece[] = ["I", "O", "T", "S", "Z", "J", "L"];

function shuffleArray<T>(arr: T[], rng: () => number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function getPieceAtIndex(seed: string, index: number): TetrisPiece {
  const rng = createSeededRng(seed);
  const bagIndex = Math.floor(index / 7);
  const posInBag = index % 7;

  // Advance RNG through previous bags
  for (let b = 0; b < bagIndex; b++) {
    shuffleArray(ALL_PIECES, rng);
  }

  const bag = shuffleArray(ALL_PIECES, rng);
  return bag[posInBag];
}

export function getCurrentAndNextPiece(
  seed: string,
  pieceIndex: number
): { current: TetrisPiece; next: TetrisPiece } {
  return {
    current: getPieceAtIndex(seed, pieceIndex),
    next: getPieceAtIndex(seed, pieceIndex + 1),
  };
}

// ── Board Representation ───────────────────────────────────────────────

export function boardToGrid(board: string): string[][] {
  const grid: string[][] = [];
  for (let r = 0; r < BOARD_HEIGHT; r++) {
    const row: string[] = [];
    for (let c = 0; c < BOARD_WIDTH; c++) {
      row.push(board[r * BOARD_WIDTH + c]);
    }
    grid.push(row);
  }
  return grid;
}

export function gridToBoard(grid: string[][]): string {
  return grid.map((row) => row.join("")).join("");
}

export function emptyBoard(): string {
  return ".".repeat(BOARD_WIDTH * BOARD_HEIGHT);
}

// ── Piece Geometry ─────────────────────────────────────────────────────

export function getPieceRotation(
  piece: TetrisPiece,
  rotation: number
): [number, number][] {
  return PIECES[piece][rotation % 4] as [number, number][];
}

export function getPieceCells(
  piece: TetrisPiece,
  rotation: number,
  column: number
): [number, number][] {
  const offsets = getPieceRotation(piece, rotation);
  return offsets.map(([r, c]) => [r, column + c]);
}

export function getPieceWidth(piece: TetrisPiece, rotation: number): number {
  const offsets = getPieceRotation(piece, rotation);
  const cols = offsets.map(([, c]) => c);
  return Math.max(...cols) - Math.min(...cols) + 1;
}

export function getPieceHeight(piece: TetrisPiece, rotation: number): number {
  const offsets = getPieceRotation(piece, rotation);
  const rows = offsets.map(([r]) => r);
  return Math.max(...rows) - Math.min(...rows) + 1;
}

// ── Placement Validation ───────────────────────────────────────────────

export function isValidPlacement(
  board: string,
  piece: TetrisPiece,
  rotation: number,
  column: number
): boolean {
  const cells = getPieceCells(piece, rotation, column);

  for (const [, c] of cells) {
    if (c < 0 || c >= BOARD_WIDTH) return false;
  }

  // Try dropping — if we can't place even at the top, invalid
  const dropped = dropPiece(board, piece, rotation, column);
  return dropped !== null;
}

// ── Gravity Drop ───────────────────────────────────────────────────────

export function dropPiece(
  board: string,
  piece: TetrisPiece,
  rotation: number,
  column: number
): [number, number][] | null {
  const offsets = getPieceRotation(piece, rotation);

  // Check column bounds
  for (const [, c] of offsets) {
    const col = column + c;
    if (col < 0 || col >= BOARD_WIDTH) return null;
  }

  // Start dropping from the top (row offset 0)
  let dropRow = 0;

  while (true) {
    // Check if piece fits at dropRow + 1
    let canDrop = true;
    for (const [r, c] of offsets) {
      const row = dropRow + 1 + r;
      const col = column + c;
      if (row >= BOARD_HEIGHT) {
        canDrop = false;
        break;
      }
      if (board[row * BOARD_WIDTH + col] !== ".") {
        canDrop = false;
        break;
      }
    }

    if (!canDrop) break;
    dropRow++;
  }

  // Verify piece fits at current dropRow
  const finalCells: [number, number][] = [];
  for (const [r, c] of offsets) {
    const row = dropRow + r;
    const col = column + c;
    if (row < 0 || row >= BOARD_HEIGHT || col < 0 || col >= BOARD_WIDTH) {
      return null;
    }
    if (board[row * BOARD_WIDTH + col] !== ".") {
      return null;
    }
    finalCells.push([row, col]);
  }

  return finalCells;
}

// ── Place Piece ────────────────────────────────────────────────────────

export function placePiece(
  board: string,
  piece: TetrisPiece,
  rotation: number,
  column: number
): string | null {
  const cells = dropPiece(board, piece, rotation, column);
  if (!cells) return null;

  const chars = board.split("");
  for (const [r, c] of cells) {
    chars[r * BOARD_WIDTH + c] = "#";
  }
  return chars.join("");
}

// ── Line Clearing ──────────────────────────────────────────────────────

export function clearLines(board: string): {
  newBoard: string;
  linesCleared: number;
} {
  const grid = boardToGrid(board);
  const remaining = grid.filter((row) => row.some((cell) => cell === "."));
  const linesCleared = BOARD_HEIGHT - remaining.length;

  if (linesCleared === 0) {
    return { newBoard: board, linesCleared: 0 };
  }

  // Add empty rows at top
  const emptyRows: string[][] = [];
  for (let i = 0; i < linesCleared; i++) {
    emptyRows.push(Array(BOARD_WIDTH).fill("."));
  }

  const newGrid = [...emptyRows, ...remaining];
  return { newBoard: gridToBoard(newGrid), linesCleared };
}

// ── Garbage Lines ──────────────────────────────────────────────────────

export function addGarbageLines(
  board: string,
  numLines: number,
  seed: string,
  counter: number
): { newBoard: string; overflowed: boolean } {
  if (numLines <= 0) return { newBoard: board, overflowed: false };

  const grid = boardToGrid(board);
  const rng = createSeededRng(seed + "_garbage_" + counter);

  // Check if top rows that would be pushed off are occupied
  for (let r = 0; r < numLines && r < BOARD_HEIGHT; r++) {
    if (grid[r].some((cell) => cell !== ".")) {
      // Board will overflow — push up anyway and mark overflow
      const garbageRows: string[][] = [];
      for (let i = 0; i < numLines; i++) {
        const gapCol = Math.floor(rng() * BOARD_WIDTH);
        const row = Array(BOARD_WIDTH).fill("#");
        row[gapCol] = ".";
        garbageRows.push(row);
      }
      const newGrid = [...grid.slice(numLines), ...garbageRows];

      // Check if any cell in top rows is filled after shift
      let overflowed = false;
      for (let r2 = 0; r2 < numLines && r2 < BOARD_HEIGHT; r2++) {
        if (grid[r2].some((cell) => cell !== ".")) {
          overflowed = true;
          break;
        }
      }

      return { newBoard: gridToBoard(newGrid), overflowed };
    }
  }

  // Safe to push — shift rows up and add garbage at bottom
  const garbageRows: string[][] = [];
  for (let i = 0; i < numLines; i++) {
    const gapCol = Math.floor(rng() * BOARD_WIDTH);
    const row = Array(BOARD_WIDTH).fill("#");
    row[gapCol] = ".";
    garbageRows.push(row);
  }

  const newGrid = [...grid.slice(numLines), ...garbageRows];
  return { newBoard: gridToBoard(newGrid), overflowed: false };
}

// ── Placement Checks ───────────────────────────────────────────────────

export function hasAnyValidPlacement(
  board: string,
  piece: TetrisPiece
): boolean {
  for (let rot = 0; rot < 4; rot++) {
    for (let col = -2; col < BOARD_WIDTH + 2; col++) {
      if (isValidPlacement(board, piece, rot, col)) {
        return true;
      }
    }
  }
  return false;
}

export function getAutoDropPlacement(
  board: string,
  piece: TetrisPiece
): { rotation: number; column: number } | null {
  // Try center first with rotation 0, then expand outward
  const centerCol = Math.floor(BOARD_WIDTH / 2) - 1; // col 4

  // Try rotation 0 first
  for (let offset = 0; offset <= BOARD_WIDTH; offset++) {
    for (const dir of [0, 1, -1]) {
      const col = centerCol + offset * dir;
      if (col < -2 || col >= BOARD_WIDTH + 2) continue;
      if (offset === 0 && dir !== 0) continue;
      if (isValidPlacement(board, piece, 0, col)) {
        return { rotation: 0, column: col };
      }
    }
  }

  // Try all rotations
  for (let rot = 1; rot < 4; rot++) {
    for (let offset = 0; offset <= BOARD_WIDTH; offset++) {
      for (const dir of [0, 1, -1]) {
        const col = centerCol + offset * dir;
        if (col < -2 || col >= BOARD_WIDTH + 2) continue;
        if (offset === 0 && dir !== 0) continue;
        if (isValidPlacement(board, piece, rot, col)) {
          return { rotation: rot, column: col };
        }
      }
    }
  }

  return null;
}

// ── Scoring & Leveling ─────────────────────────────────────────────────

export function calculateScore(linesCleared: number, level: number): number {
  if (linesCleared <= 0) return 0;
  const base = SCORING[linesCleared] ?? linesCleared * 100;
  return base * level;
}

export function calculateGarbageSent(linesCleared: number): number {
  if (linesCleared <= 0) return 0;
  return GARBAGE[linesCleared] ?? 0;
}

export function calculateLevel(totalLines: number): number {
  return Math.floor(totalLines / LINES_PER_LEVEL) + 1;
}

export function calculateGravityInterval(level: number): number {
  return Math.max(
    MIN_GRAVITY_SECONDS,
    BASE_GRAVITY_SECONDS - (level - 1) * REDUCTION_PER_LEVEL
  );
}

// ── Apply Move (orchestrator) ──────────────────────────────────────────

export interface ApplyMoveResult {
  newBoard: string;
  linesCleared: number;
  garbageSent: number;
  garbageReceived: number;
  newScore: number;
  newLines: number;
  newLevel: number;
  alive: boolean;
}

export function applyMove(
  board: string,
  piece: TetrisPiece,
  rotation: number,
  column: number,
  pendingGarbage: number,
  score: number,
  lines: number,
  level: number,
  seed: string,
  garbageCounter: number
): ApplyMoveResult {
  let currentBoard = board;
  let garbageReceived = 0;
  let alive = true;

  // 1. Apply pending garbage before placing piece
  if (pendingGarbage > 0) {
    const garbageResult = addGarbageLines(
      currentBoard,
      pendingGarbage,
      seed,
      garbageCounter
    );
    currentBoard = garbageResult.newBoard;
    garbageReceived = pendingGarbage;

    if (garbageResult.overflowed) {
      return {
        newBoard: currentBoard,
        linesCleared: 0,
        garbageSent: 0,
        garbageReceived,
        newScore: score,
        newLines: lines,
        newLevel: level,
        alive: false,
      };
    }
  }

  // 2. Place the piece
  const placedBoard = placePiece(currentBoard, piece, rotation, column);
  if (!placedBoard) {
    // Can't place — game over
    return {
      newBoard: currentBoard,
      linesCleared: 0,
      garbageSent: 0,
      garbageReceived,
      newScore: score,
      newLines: lines,
      newLevel: level,
      alive: false,
    };
  }

  // 3. Clear lines
  const { newBoard: clearedBoard, linesCleared } = clearLines(placedBoard);

  // 4. Calculate new stats
  const newLines = lines + linesCleared;
  const newLevel = calculateLevel(newLines);
  const newScore = score + calculateScore(linesCleared, newLevel);
  const garbageSent = calculateGarbageSent(linesCleared);

  return {
    newBoard: clearedBoard,
    linesCleared,
    garbageSent,
    garbageReceived,
    newScore,
    newLines,
    newLevel,
    alive: true,
  };
}
