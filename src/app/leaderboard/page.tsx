import Leaderboard from "@/components/Leaderboard";

export const metadata = {
  title: "Leaderboard — MoltGames",
};

export default function LeaderboardPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8 text-[var(--primary)]">Leaderboard</h1>
      <div className="bg-[var(--surface)] rounded-none border border-[var(--border)] overflow-hidden">
        <Leaderboard />
      </div>
    </div>
  );
}
