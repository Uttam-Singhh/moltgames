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
