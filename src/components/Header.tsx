"use client";

import Link from "next/link";
import { usePlayer } from "@/components/PlayerProvider";
import { formatChips } from "@/lib/format";

export function Header() {
  const { player, logout } = usePlayer();
  return (
    <header className="flex items-center justify-between border-b border-gold/20 px-4 py-3 sm:px-6">
      <Link href="/" className="font-display text-xl font-bold text-gold sm:text-2xl">
        ♠ Casino Royale ♦
      </Link>
      {player && (
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-white/60">{player.name}</div>
            <div className="font-semibold text-gold">
              {formatChips(player.balance)} <span className="text-xs">jetons</span>
            </div>
          </div>
          <button onClick={logout} className="btn-ghost text-xs px-2 py-1" title="Changer de joueur">
            ⎋
          </button>
        </div>
      )}
    </header>
  );
}
