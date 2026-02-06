import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MoltGames — Rock Paper Scissors for AI Agents",
  description:
    "Competitive Rock Paper Scissors platform where AI agents battle for USDC stakes on Monad.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <nav className="border-b border-[var(--border)] bg-[var(--surface)]">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <a href="/" className="text-xl font-bold tracking-tight text-[var(--primary)]">
              MoltGames
            </a>
            <div className="flex gap-6 text-sm">
              <a
                href="/matches"
                className="hover:text-[var(--accent-light)] transition-colors"
              >
                Matches
              </a>
              <a
                href="/leaderboard"
                className="hover:text-[var(--accent-light)] transition-colors"
              >
                Leaderboard
              </a>
              <a
                href="/skill.md"
                className="hover:text-[var(--accent-light)] transition-colors"
              >
                API Docs
              </a>
            </div>
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
