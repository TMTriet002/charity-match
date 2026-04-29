import type { Metadata } from "next";
import { Quicksand, JetBrains_Mono } from "next/font/google";
import { QueryProvider } from "./query-provider";
import { WalletProvider } from "./wallet-context";
import { ErrorListener } from "./error-listener";
import "./globals.css";

const sans = Quicksand({ subsets: ["latin"], variable: "--font-quicksand" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: "Match Up",
  description:
    "Donor pool with sponsor-matched 1:1 funds on Stellar Testnet. Donate and the sponsor doubles it up to the cap.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased">
        <ErrorListener />
        <QueryProvider>
          <WalletProvider>{children}</WalletProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
