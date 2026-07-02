import type { Metadata } from "next";
import { Unbounded, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { PlayerProvider } from "@/components/PlayerProvider";

// Display : Unbounded — dessin large, asymétrique, quasi brutaliste.
const display = Unbounded({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-display",
  display: "swap",
});

// Données & corps : IBM Plex Mono — esprit terminal comptable.
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CASINO ROYALE // LEDGER.SYS",
  description: "Casino multijoueur clandestin en temps réel. Jetons fictifs.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={`${display.variable} ${mono.variable}`}>
      <body>
        <PlayerProvider>{children}</PlayerProvider>
        <div className="crt-overlay" aria-hidden />
      </body>
    </html>
  );
}
