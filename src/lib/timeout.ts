import { db } from "@/db";
import { matches, rounds, players } from "@/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { calculateEloChange } from "./elo";
import { sendPayout } from "./x402";
import { ENTRY_FEE_USDC, GAME_CONSTANTS } from "./constants";

/**
 * Checks if the current round of an in-progress match has timed out.
 * If so, forfeits the non-responding player, updates stats, and triggers payout.
 * Returns the updated match status or null if no timeout occurred.
 */
export async function checkAndResolveTimeout(
  matchId: string
): Promise<{
  forfeited: boolean;
  winnerId?: string;
  loserId?: string;
  payoutTx?: string | null;
} | null> {
  const [match] = await db
    .select()
    .from(matches)
    .where(eq(matches.id, matchId))
    .limit(1);

  if (!match || match.status !== "in_progress") return null;

  // Find the current unresolved round
  const [currentRound] = await db
    .select()
    .from(rounds)
    .where(
      and(
        eq(rounds.matchId, matchId),
        eq(rounds.roundNumber, match.currentRound),
        isNull(rounds.resolvedAt)
      )
    )
    .limit(1);

  if (!currentRound) return null;

  const roundAge = Date.now() - currentRound.createdAt.getTime();
  if (roundAge <= GAME_CONSTANTS.ROUND_TIMEOUT_SECONDS * 1000) {
    return null; // Not timed out yet
  }

  // Determine who timed out
  let winnerId: string;
  let loserId: string;

  if (!currentRound.player1Move && !currentRound.player2Move) {
    // Both timed out — player1 forfeits (arbitrary)
    winnerId = match.player2Id;
    loserId = match.player1Id;
  } else if (!currentRound.player1Move) {
    winnerId = match.player2Id;
    loserId = match.player1Id;
  } else {
    winnerId = match.player1Id;
    loserId = match.player2Id;
  }

  // Get players for ELO
  const [winner] = await db
    .select()
    .from(players)
    .where(eq(players.id, winnerId))
    .limit(1);
  const [loser] = await db
    .select()
    .from(players)
    .where(eq(players.id, loserId))
    .limit(1);

  if (!winner || !loser) return null;

  const { winnerChange, loserChange } = calculateEloChange(
    winner.eloRating,
    loser.eloRating
  );

  // Send payout
  const payoutAmount = String(parseFloat(ENTRY_FEE_USDC) * 2);
  let payoutTx: string | null = null;
  if (winner.walletAddress) {
    payoutTx = await sendPayout(winner.walletAddress, payoutAmount);
  }

  // Resolve the round
  await db
    .update(rounds)
    .set({ resolvedAt: new Date() })
    .where(eq(rounds.id, currentRound.id));

  // Update match as forfeited
  await db
    .update(matches)
    .set({
      winnerId,
      status: "forfeited",
      completedAt: new Date(),
      player1EloChange:
        winnerId === match.player1Id ? winnerChange : loserChange,
      player2EloChange:
        winnerId === match.player2Id ? winnerChange : loserChange,
      payoutTx,
    })
    .where(eq(matches.id, match.id));

  // Update player stats
  await db
    .update(players)
    .set({
      eloRating: winner.eloRating + winnerChange,
      wins: winner.wins + 1,
      totalMatches: winner.totalMatches + 1,
      totalEarnings: String(
        parseFloat(winner.totalEarnings) + parseFloat(payoutAmount)
      ),
      updatedAt: new Date(),
    })
    .where(eq(players.id, winnerId));

  await db
    .update(players)
    .set({
      eloRating: loser.eloRating + loserChange,
      losses: loser.losses + 1,
      totalMatches: loser.totalMatches + 1,
      updatedAt: new Date(),
    })
    .where(eq(players.id, loserId));

  return { forfeited: true, winnerId, loserId, payoutTx };
}
