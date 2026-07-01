"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePlayer } from "@/components/PlayerProvider";
import { formatChips } from "@/lib/format";
import { Logo } from "@/components/Logo";

export function Header() {
  const { player, logout } = usePlayer();
  const prevBalance = useRef<number | null>(null);
  const [flash, setFlash] = useState(false);

  // Flash doré quand le solde augmente (gain).
  useEffect(() => {
    if (player == null) {
      prevBalance.current = null;
      return;
    }
    if (prevBalance.current != null && player.balance > prevBalance.current) {
      setFlash(true);
      const id = setTimeout(() => setFlash(false), 900);
      prevBalance.current = player.balance;
      return () => clearTimeout(id);
    }
    prevBalance.current = player.balance;
  }, [player?.balance, player]);

  return (
    <header className="flex items-center justify-between border-b border-neon-cyan/25 px-4 py-3 shadow-[0_6px_20px_-12px_rgba(0,240,255,0.6)] sm:px-6">
      <Link href="/" className="flex items-center gap-2 font-display text-lg font-black tracking-widest sm:text-2xl">
        <Logo size={36} className="shrink-0" />
        <span className="glitch hidden sm:inline" data-text="CASINO ROYALE">
          CASINO ROYALE
        </span>
        <span className="glitch sm:hidden" data-text="C·R">
          C·R
        </span>
      </Link>
      {player && (
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest text-neon-magenta/80">
              {player.name}
            </div>
            <div className={`stat text-lg font-semibold text-neon-cyan ${flash ? "balance-flash" : ""}`}>
              {formatChips(player.balance)} <span className="text-[10px] text-neon-cyan/60">◆ JETONS</span>
            </div>
          </div>
          <button onClick={logout} className="btn-ghost px-2 py-1 text-xs" title="Changer de joueur">
            ⎋
          </button>
        </div>
      )}
    </header>
  );
}
