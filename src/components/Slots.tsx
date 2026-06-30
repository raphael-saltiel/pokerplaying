"use client";

import { useState } from "react";
import { usePlayer } from "@/components/PlayerProvider";
import { formatChips } from "@/lib/format";

const BETS = [10, 50, 100, 500];

export function Slots() {
  const { player, setBalance } = usePlayer();
  const [reels, setReels] = useState(["🍒", "🍋", "🔔"]);
  const [bet, setBet] = useState(50);
  const [spinning, setSpinning] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function spin() {
    if (!player || spinning) return;
    setSpinning(true);
    setErr(null);
    setMsg(null);
    // petite animation de défilement
    const anim = setInterval(() => {
      setReels([rnd(), rnd(), rnd()]);
    }, 70);
    try {
      const res = await fetch("/api/slots/spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: player.id, bet }),
      });
      const data = await res.json();
      clearInterval(anim);
      if (!res.ok) {
        setErr(data.error ?? "Erreur");
        setSpinning(false);
        return;
      }
      // léger délai pour l'effet
      setTimeout(() => {
        setReels(data.reels);
        setBalance(data.balance);
        if (data.payout > 0) {
          setMsg(`🎉 Gagné +${formatChips(data.payout)} jetons !`);
        } else if (data.payout === 0) {
          setMsg(`😐 Mise rendue (±0).`);
        } else {
          setMsg(`Perdu ${formatChips(bet)} jetons.`);
        }
        setSpinning(false);
      }, 300);
    } catch {
      clearInterval(anim);
      setErr("Réseau indisponible.");
      setSpinning(false);
    }
  }

  return (
    <div className="card-surface p-5">
      <h3 className="mb-1 font-display text-xl text-gold">🎰 Machine à sous</h3>
      <p className="mb-4 text-xs text-white/60">Jeu solo · 3 identiques = jackpot (💎 ×100)</p>

      <div className="mb-4 flex justify-center gap-2 rounded-xl bg-black/50 p-4">
        {reels.map((r, i) => (
          <div
            key={i}
            className="flex h-16 w-16 items-center justify-center rounded-lg bg-white/5 text-4xl"
          >
            {r}
          </div>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-center gap-2">
        {BETS.map((b) => (
          <button
            key={b}
            onClick={() => setBet(b)}
            className={bet === b ? "btn-gold px-3 py-1 text-sm" : "btn-dark px-3 py-1 text-sm"}
          >
            {b}
          </button>
        ))}
      </div>

      <button onClick={spin} disabled={spinning || !player} className="btn-gold w-full">
        {spinning ? "🎲 …" : `Lancer (${bet})`}
      </button>

      {msg && <p className="mt-3 text-center text-sm text-gold">{msg}</p>}
      {err && <p className="mt-3 text-center text-sm text-red-400">{err}</p>}
    </div>
  );
}

function rnd() {
  const s = ["🍒", "🍋", "🔔", "⭐", "7️⃣", "💎"];
  return s[Math.floor(Math.random() * s.length)];
}
