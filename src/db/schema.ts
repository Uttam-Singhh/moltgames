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

export const matchStatusEnum = pgEnum("match_status", [
  "in_progress",
  "completed",
  "forfeited",
]);

export const moveEnum = pgEnum("move", ["rock", "paper", "scissors"]);

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
