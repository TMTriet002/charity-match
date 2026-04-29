import { WalletButton } from "@/components/wallet-button";
import { Dashboard } from "@/components/dashboard";
import { HeroSection } from "@/components/hero-section";
import { StatsStrip } from "@/components/stats-strip";

export default function Home() {
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <header className="flex items-center justify-between gap-3 pb-4">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            <span
              className="bg-gradient-to-r from-[#ec4899] to-[#7c3aed] bg-clip-text text-transparent"
            >
              Match Up
            </span>
          </h1>
          <WalletButton />
        </header>

        <HeroSection />
        <StatsStrip />

        <div className="mt-8">
          <Dashboard />
        </div>

        <footer className="mt-12 text-center text-xs text-muted">
          A small Stellar Testnet dApp built on Soroban.
        </footer>
      </div>
    </main>
  );
}
