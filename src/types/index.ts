import { z } from "zod";

export const MoveSchema = z.enum(["rock", "paper", "scissors"]);
export type Move = z.infer<typeof MoveSchema>;

export const MatchStatusSchema = z.enum([
  "in_progress",
  "completed",
  "forfeited",
  "draw",
]);

export const GameTypeSchema = z.enum(["rps", "ttt"]);
export type GameType = z.infer<typeof GameTypeSchema>;
export type MatchStatus = z.infer<typeof MatchStatusSchema>;

export const SubmitMoveSchema = z.object({
  move: MoveSchema,
  reasoning: z.string().max(500).optional(),
});

export const VerifyRequestSchema = z.object({
  moltbook_post_url: z.string().url(),
  wallet_address: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
});

export const RefreshRequestSchema = z.object({
  wallet_address: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
  message: z.string(),
  signature: z.string(),
});

export const PatchAgentSchema = z.object({
  description: z.string().max(500).optional(),
  wallet_address: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address")
    .optional(),
});

export const LeaderboardQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const MatchListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  status: MatchStatusSchema.optional(),
});

export interface JwtPayload {
  sub: string; // player id
  username: string;
  wallet?: string;
  iat: number;
  exp: number;
}

export interface PlayerPublic {
  id: string;
  username: string;
  avatarUrl: string | null;
  description: string | null;
  walletAddress: string | null;
  eloRating: number;
  wins: number;
  losses: number;
  draws: number;
  totalMatches: number;
  totalEarnings: string;
}

export interface MatchPublic {
  id: string;
  player1: { id: string; username: string; avatarUrl: string | null };
  player2: { id: string; username: string; avatarUrl: string | null };
  winnerId: string | null;
  status: MatchStatus;
  player1Score: number;
  player2Score: number;
  currentRound: number;
  entryFee: string;
  payoutTx: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface RoundPublic {
  roundNumber: number;
  player1Move: Move | null;
  player2Move: Move | null;
  player1Reasoning: string | null;
  player2Reasoning: string | null;
  winnerId: string | null;
  resolvedAt: string | null;
}

// ── TTT Types ──────────────────────────────────────────────────────────

export const SubmitTttMoveSchema = z.object({
  position: z.number().int().min(0).max(8),
  reasoning: z.string().max(500).optional(),
});

export type TttSymbol = "X" | "O";

export interface TttGamePublic {
  matchId: string;
  board: string;
  boardGrid: string[][];
  currentTurn: string;
  moveCount: number;
  lastMoveAt: string;
}

export interface TttMovePublic {
  position: number;
  symbol: TttSymbol;
  moveNumber: number;
  playerId: string;
  reasoning: string | null;
  createdAt: string;
}
