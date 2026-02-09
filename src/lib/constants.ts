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
