export const GAME_CONSTANTS = {
  WINS_TO_WIN: 2,
  MAX_ROUNDS: 3,
  ROUND_TIMEOUT_SECONDS: 30,
  MOVES: ["rock", "paper", "scissors"] as const,
} as const;

export const ELO_K_FACTOR = 32;

export const ENTRY_FEE_USDC = "0.10";

export const RATE_LIMITS = {
  GLOBAL_PER_MINUTE: 100,
  QUEUE_POLL_PER_SECOND: 1,
  MATCH_POLL_PER_SECOND: 2,
} as const;

export const JWT_EXPIRY_HOURS = 24;
export const CHALLENGE_EXPIRY_MINUTES = 15;

export const MONAD_CHAIN_ID = 143; // Mainnet
export const MONAD_RPC = "https://rpc.monad.xyz";
export const MONAD_EXPLORER = "https://monadscan.com";

export const USDC_DECIMALS = 6;

export const TTT_CONSTANTS = {
  BOARD_SIZE: 9,
  TURN_TIMEOUT_SECONDS: 30,
  WIN_LINES: [
    [0, 1, 2], // top row
    [3, 4, 5], // middle row
    [6, 7, 8], // bottom row
    [0, 3, 6], // left column
    [1, 4, 7], // middle column
    [2, 5, 8], // right column
    [0, 4, 8], // diagonal top-left to bottom-right
    [2, 4, 6], // diagonal top-right to bottom-left
  ],
} as const;

export const TETRIS_CONSTANTS = {
  BOARD_WIDTH: 10,
  BOARD_HEIGHT: 20,
  BOARD_SIZE: 200, // 10 * 20

  // Gravity (auto-drop interval)
  BASE_GRAVITY_SECONDS: 30,
  REDUCTION_PER_LEVEL: 2.5,
  MIN_GRAVITY_SECONDS: 5,

  // Level progression
  LINES_PER_LEVEL: 10,

  // Scoring per lines cleared
  SCORING: { 1: 100, 2: 300, 3: 500, 4: 800 } as Record<number, number>,

  // Garbage lines sent per lines cleared
  GARBAGE: { 1: 0, 2: 1, 3: 2, 4: 4 } as Record<number, number>,

  // SRS piece definitions: each piece has 4 rotation states
  // Cells are [row, col] offsets from the piece origin
  PIECES: {
    I: [
      [[0, 0], [0, 1], [0, 2], [0, 3]],
      [[0, 0], [1, 0], [2, 0], [3, 0]],
      [[0, 0], [0, 1], [0, 2], [0, 3]],
      [[0, 0], [1, 0], [2, 0], [3, 0]],
    ],
    O: [
      [[0, 0], [0, 1], [1, 0], [1, 1]],
      [[0, 0], [0, 1], [1, 0], [1, 1]],
      [[0, 0], [0, 1], [1, 0], [1, 1]],
      [[0, 0], [0, 1], [1, 0], [1, 1]],
    ],
    T: [
      [[0, 0], [0, 1], [0, 2], [1, 1]],
      [[0, 0], [1, 0], [2, 0], [1, 1]],
      [[1, 0], [1, 1], [1, 2], [0, 1]],
      [[0, 0], [1, 0], [2, 0], [1, -1]],
    ],
    S: [
      [[0, 1], [0, 2], [1, 0], [1, 1]],
      [[0, 0], [1, 0], [1, 1], [2, 1]],
      [[0, 1], [0, 2], [1, 0], [1, 1]],
      [[0, 0], [1, 0], [1, 1], [2, 1]],
    ],
    Z: [
      [[0, 0], [0, 1], [1, 1], [1, 2]],
      [[0, 1], [1, 0], [1, 1], [2, 0]],
      [[0, 0], [0, 1], [1, 1], [1, 2]],
      [[0, 1], [1, 0], [1, 1], [2, 0]],
    ],
    J: [
      [[0, 0], [1, 0], [1, 1], [1, 2]],
      [[0, 0], [0, 1], [1, 0], [2, 0]],
      [[0, 0], [0, 1], [0, 2], [1, 2]],
      [[0, 0], [1, 0], [2, 0], [2, -1]],
    ],
    L: [
      [[0, 2], [1, 0], [1, 1], [1, 2]],
      [[0, 0], [1, 0], [2, 0], [2, 1]],
      [[0, 0], [0, 1], [0, 2], [1, 0]],
      [[0, 0], [0, 1], [1, 1], [2, 1]],
    ],
  } as Record<string, [number, number][][]>,

  // Per-piece colors (neon arcade theme)
  PIECE_COLORS: {
    I: { bg: "#00e5ff", shadow: "rgba(0, 229, 255, 0.4)", border: "rgba(0, 229, 255, 0.6)" },
    O: { bg: "#ffd600", shadow: "rgba(255, 214, 0, 0.4)", border: "rgba(255, 214, 0, 0.6)" },
    T: { bg: "#d500f9", shadow: "rgba(213, 0, 249, 0.4)", border: "rgba(213, 0, 249, 0.6)" },
    S: { bg: "#00e676", shadow: "rgba(0, 230, 118, 0.4)", border: "rgba(0, 230, 118, 0.6)" },
    Z: { bg: "#ff1744", shadow: "rgba(255, 23, 68, 0.4)", border: "rgba(255, 23, 68, 0.6)" },
    J: { bg: "#448aff", shadow: "rgba(68, 138, 255, 0.4)", border: "rgba(68, 138, 255, 0.6)" },
    L: { bg: "#ff9100", shadow: "rgba(255, 145, 0, 0.4)", border: "rgba(255, 145, 0, 0.6)" },
    G: { bg: "#666666", shadow: "rgba(102, 102, 102, 0.4)", border: "rgba(102, 102, 102, 0.6)" },
    "#": { bg: "#4488ff", shadow: "rgba(68, 136, 255, 0.4)", border: "rgba(68, 136, 255, 0.6)" },
  } as Record<string, { bg: string; shadow: string; border: string }>,
} as const;
