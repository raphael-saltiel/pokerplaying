import type { Metadata } from "next";
import "./globals.css";
import { PlayerProvider } from "@/components/PlayerProvider";

export const metadata: Metadata = {
  title: "Casino Royale",
  description: "Casino multijoueur en temps réel pour jouer entre collègues.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>
        <PlayerProvider>{children}</PlayerProvider>
      </body>
    </html>
  );
}
