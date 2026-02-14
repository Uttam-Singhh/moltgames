import {
  pgTable,
  uuid,
  text,
  integer,
  decimal,
  boolean,
  timestamp,
  pgEnum,
  varchar,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const gameTypeEnum = pgEnum("game_type", ["rps", "ttt", "tetris"]);

export const matchStatusEnum = pgEnum("match_status", [
  "in_progress",
  "completed",
  "forfeited",
  "draw",
]);

export const moveEnum = pgEnum("move", ["rock", "paper", "scissors"]);

export const tttSymbolEnum = pgEnum("ttt_symbol", ["X", "O"]);

export const players = pgTable("players", {
  id: uuid("id").defaultRandom().primaryKey(),
  moltbookId: text("moltbook_id").unique().notNull(),
  username: text("username").unique().notNull(),
  avatarUrl: text("avatar_url"),
  description: text("description"),
  walletAddress: text("wallet_address"),
  eloRating: integer("elo_rating").default(1000).notNull(),
  wins: integer("wins").default(0).notNull(),
  losses: integer("losses").default(0).notNull(),
  draws: integer("draws").default(0).notNull(),
  totalMatches: integer("total_matches").default(0).notNull(),
  totalEarnings: decimal("total_earnings", { precision: 18, scale: 6 })
    .default("0")
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const matches = pgTable("matches", {
  id: uuid("id").defaultRandom().primaryKey(),
  gameType: gameTypeEnum("game_type").default("rps").notNull(),
  player1Id: uuid("player1_id")
    .references(() => players.id)
    .notNull(),
  player2Id: uuid("player2_id")
    .references(() => players.id)
    .notNull(),
  winnerId: uuid("winner_id").references(() => players.id),
  status: matchStatusEnum("status").default("in_progress").notNull(),
  player1Score: integer("player1_score").default(0).notNull(),
  player2Score: integer("player2_score").default(0).notNull(),
  currentRound: integer("current_round").default(1).notNull(),
  player1EloChange: integer("player1_elo_change"),
  player2EloChange: integer("player2_elo_change"),
  entryFee: decimal("entry_fee", { precision: 18, scale: 6 }).notNull(),
  player1PaymentReceipt: text("player1_payment_receipt"),
  player2PaymentReceipt: text("player2_payment_receipt"),
  payoutTx: text("payout_tx"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const rounds = pgTable("rounds", {
  id: uuid("id").defaultRandom().primaryKey(),
  matchId: uuid("match_id")
    .references(() => matches.id)
    .notNull(),
  roundNumber: integer("round_number").notNull(),
  player1Move: moveEnum("player1_move"),
  player2Move: moveEnum("player2_move"),
  player1Reasoning: varchar("player1_reasoning", { length: 500 }),
  player2Reasoning: varchar("player2_reasoning", { length: 500 }),
  winnerId: uuid("winner_id").references(() => players.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export const queue = pgTable(
  "queue",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    playerId: uuid("player_id")
      .references(() => players.id)
      .notNull(),
    walletAddress: text("wallet_address"),
    paymentReceipt: text("payment_receipt"),
    eloRating: integer("elo_rating").default(1000).notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("queue_player_id_idx").on(table.playerId)]
);

export const challenges = pgTable("challenges", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").unique().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  used: boolean("used").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ── TTT Tables ───────────────────────────────────────────────────────────

export const tttGames = pgTable(
  "ttt_games",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    matchId: uuid("match_id")
      .references(() => matches.id)
      .notNull(),
    roundNumber: integer("round_number").default(1).notNull(),
    board: varchar("board", { length: 9 }).default("---------").notNull(),
    currentTurn: uuid("current_turn")
      .references(() => players.id)
      .notNull(),
    moveCount: integer("move_count").default(0).notNull(),
    winnerId: uuid("winner_id").references(() => players.id),
    isDraw: boolean("is_draw").default(false).notNull(),
    lastMoveAt: timestamp("last_move_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("ttt_games_match_round_idx").on(
      table.matchId,
      table.roundNumber
    ),
  ]
);

export const tttMoves = pgTable("ttt_moves", {
  id: uuid("id").defaultRandom().primaryKey(),
  matchId: uuid("match_id")
    .references(() => matches.id)
    .notNull(),
  roundNumber: integer("round_number").default(1).notNull(),
  playerId: uuid("player_id")
    .references(() => players.id)
    .notNull(),
  position: integer("position").notNull(),
  symbol: tttSymbolEnum("symbol").notNull(),
  moveNumber: integer("move_number").notNull(),
  reasoning: varchar("reasoning", { length: 500 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const tttQueue = pgTable(
  "ttt_queue",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    playerId: uuid("player_id")
      .references(() => players.id)
      .notNull(),
    walletAddress: text("wallet_address"),
    paymentReceipt: text("payment_receipt"),
    eloRating: integer("elo_rating").default(1000).notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("ttt_queue_player_id_idx").on(table.playerId)]
);

// ── Tetris Tables ─────────────────────────────────────────────────────

export const tetrisPieceEnum = pgEnum("tetris_piece", [
  "I",
  "O",
  "T",
  "S",
  "Z",
  "J",
  "L",
]);

export const tetrisGames = pgTable(
  "tetris_games",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    matchId: uuid("match_id")
      .references(() => matches.id)
      .notNull(),
    seed: text("seed").notNull(),
    // Player 1 state
    player1Board: varchar("player1_board", { length: 200 })
      .default(".".repeat(200))
      .notNull(),
    player1Score: integer("player1_score").default(0).notNull(),
    player1Lines: integer("player1_lines").default(0).notNull(),
    player1Level: integer("player1_level").default(1).notNull(),
    player1PieceIndex: integer("player1_piece_index").default(0).notNull(),
    player1PendingGarbage: integer("player1_pending_garbage")
      .default(0)
      .notNull(),
    player1Alive: boolean("player1_alive").default(true).notNull(),
    player1LastMoveAt: timestamp("player1_last_move_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    // Player 2 state
    player2Board: varchar("player2_board", { length: 200 })
      .default(".".repeat(200))
      .notNull(),
    player2Score: integer("player2_score").default(0).notNull(),
    player2Lines: integer("player2_lines").default(0).notNull(),
    player2Level: integer("player2_level").default(1).notNull(),
    player2PieceIndex: integer("player2_piece_index").default(0).notNull(),
    player2PendingGarbage: integer("player2_pending_garbage")
      .default(0)
      .notNull(),
    player2Alive: boolean("player2_alive").default(true).notNull(),
    player2LastMoveAt: timestamp("player2_last_move_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("tetris_games_match_id_idx").on(table.matchId)]
);

export const tetrisMoves = pgTable("tetris_moves", {
  id: uuid("id").defaultRandom().primaryKey(),
  matchId: uuid("match_id")
    .references(() => matches.id)
    .notNull(),
  playerId: uuid("player_id")
    .references(() => players.id)
    .notNull(),
  piece: tetrisPieceEnum("piece").notNull(),
  rotation: integer("rotation").notNull(),
  column: integer("column").notNull(),
  linesCleared: integer("lines_cleared").default(0).notNull(),
  garbageSent: integer("garbage_sent").default(0).notNull(),
  garbageReceived: integer("garbage_received").default(0).notNull(),
  scoreAfter: integer("score_after").default(0).notNull(),
  levelAfter: integer("level_after").default(1).notNull(),
  boardAfter: varchar("board_after", { length: 200 }).notNull(),
  moveNumber: integer("move_number").notNull(),
  isAutoDrop: boolean("is_auto_drop").default(false).notNull(),
  reasoning: varchar("reasoning", { length: 500 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const tetrisQueue = pgTable(
  "tetris_queue",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    playerId: uuid("player_id")
      .references(() => players.id)
      .notNull(),
    walletAddress: text("wallet_address"),
    paymentReceipt: text("payment_receipt"),
    eloRating: integer("elo_rating").default(1000).notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("tetris_queue_player_id_idx").on(table.playerId)]
);
