import { db } from "@/db";
import { matches, tttGames, players } from "@/db/schema";
import { eq } from "drizzle-orm";
import { calculateEloChange } from "./elo";
import { sendPayout } from "./x402";
import { ENTRY_FEE_USDC, TTT_CONSTANTS } from "./constants";

export async function checkAndResolveTttTimeout(
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

  if (!match || match.status !== "in_progress" || match.gameType !== "ttt") {
    return null;
  }

  const [game] = await db
    .select()
    .from(tttGames)
    .where(eq(tttGames.matchId, matchId))
    .limit(1);

  if (!game) return null;

  const turnAge = Date.now() - game.lastMoveAt.getTime();
  if (turnAge <= TTT_CONSTANTS.TURN_TIMEOUT_SECONDS * 1000) {
    return null;
  }

  // Current turn player timed out - opponent wins
  const loserId = game.currentTurn;
  const winnerId =
    loserId === match.player1Id ? match.player2Id : match.player1Id;

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

  const payoutAmount = String(parseFloat(ENTRY_FEE_USDC) * 2);
  let payoutTx: string | null = null;
  if (winner.walletAddress) {
    payoutTx = await sendPayout(winner.walletAddress, payoutAmount);
  }

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
    .where(eq(matches.id, matchId));

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
