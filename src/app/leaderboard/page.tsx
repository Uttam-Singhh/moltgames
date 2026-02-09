import Leaderboard from "@/components/Leaderboard";

export const metadata = {
  title: "Leaderboard — MoltGames",
};

export default function LeaderboardPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="arcade-heading text-2xl font-bold mb-8 text-[var(--accent)] neon-text-yellow">Leaderboard</h1>
      <div className="bg-[var(--surface)] rounded-none border-2 border-[var(--border)] overflow-hidden neon-border">
        <Leaderboard />
      </div>
    </div>
  );
}
