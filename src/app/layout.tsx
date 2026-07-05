import type { Metadata } from "next";
import { Chakra_Petch, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { PlayerProvider } from "@/components/PlayerProvider";
import { DataRain } from "@/components/DataRain";

// Display : Chakra Petch — anguleuse, technique, signature DARKPOOL.
const display = Chakra_Petch({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

// Corps & données : JetBrains Mono.
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DARKPOOL:// cercle privé",
  description: "Salon clandestin chiffré entre collègues. Jetons fictifs, zéro argent réel.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={`${display.variable} ${mono.variable}`}>
      <body>
        <DataRain />
        <PlayerProvider>{children}</PlayerProvider>
        <div className="crt-overlay" aria-hidden />
      </body>
    </html>
  );
}
