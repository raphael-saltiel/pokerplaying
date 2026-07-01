"use client";

import { useState } from "react";
import { usePlayer } from "@/components/PlayerProvider";
import { formatChips } from "@/lib/format";
import { fireConfetti } from "@/lib/confetti";

const BETS = [10, 50, 100, 500];
const SYMBOLS = ["🍒", "🍋", "🔔", "⭐", "7️⃣", "💎"];

export function Slots() {
  const { player, setBalance } = usePlayer();
  const [reels, setReels] = useState(["🍒", "🍋", "🔔"]);
  const [bet, setBet] = useState(50);
  const [spinning, setSpinning] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [win, setWin] = useState<{ payout: number; mult: number } | null>(null);

  async function spin() {
    if (!player || spinning) return;
    setSpinning(true);
    setErr(null);
    setMsg(null);
    setWin(null);
    try {
      const res = await fetch("/api/slots/spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: player.id, bet }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Erreur");
        setSpinning(false);
        return;
      }
      // On laisse les rouleaux défiler un court instant avant d'afficher le résultat.
      setTimeout(() => {
        setReels(data.reels);
        setBalance(data.balance);
        if (data.payout > 0) {
          setMsg(`🎉 Gagné +${formatChips(data.payout)} jetons !`);
          setWin({ payout: data.payout, mult: bet > 0 ? Math.round(data.gross / bet) : 0 });
          fireConfetti();
        } else if (data.payout === 0) {
          setMsg("😐 Mise rendue (±0).");
        } else {
          setMsg(`Perdu ${formatChips(bet)} jetons.`);
        }
        setSpinning(false);
      }, 750);
    } catch {
      setErr("Réseau indisponible.");
      setSpinning(false);
    }
  }

  return (
    <div className="card-surface p-5">
      <h3 className="mb-1 font-display text-xl font-bold text-neon-cyan">🎰 Machine à sous</h3>
      <p className="mb-4 text-xs text-white/60">Jeu solo · 3 identiques = jackpot (💎 ×100)</p>

      <div className="mb-4 flex justify-center gap-3 rounded-xl bg-ink-900/60 p-4">
        {reels.map((r, i) => (
          <SlotReel key={i} symbol={r} spinning={spinning} idx={i} />
        ))}
      </div>

      {win && (
        <div className="mb-3 text-center">
          <span className="stat text-3xl font-black text-neon-yellow">×{win.mult}</span>
        </div>
      )}

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

      {msg && <p className="mt-3 text-center text-sm text-neon-cyan">{msg}</p>}
      {err && <p className="mt-3 text-center text-sm text-red-400">{err}</p>}

      <Paytable />
    </div>
  );
}

function SlotReel({ symbol, spinning, idx }: { symbol: string; spinning: boolean; idx: number }) {
  const strip = [...SYMBOLS, ...SYMBOLS]; // dupliqué pour une boucle sans couture
  return (
    <div className="reel-window">
      {spinning ? (
        <div className="reel-strip spinning" style={{ animationDuration: `${0.35 + idx * 0.08}s` }}>
          {strip.map((s, i) => (
            <div key={i} className="reel-cell">
              {s}
            </div>
          ))}
        </div>
      ) : (
        <div className="reel-strip">
          <div className="reel-cell">{symbol}</div>
        </div>
      )}
    </div>
  );
}

const PAYTABLE: { combo: string; label: string; mult: string }[] = [
  { combo: "💎 💎 💎", label: "Trois diamants", mult: "×100" },
  { combo: "7️⃣ 7️⃣ 7️⃣", label: "Trois sept", mult: "×40" },
  { combo: "⭐ ⭐ ⭐", label: "Trois étoiles", mult: "×20" },
  { combo: "🔔 🔔 🔔", label: "Trois cloches", mult: "×12" },
  { combo: "🍋 🍋 🍋", label: "Trois citrons", mult: "×8" },
  { combo: "🍒 🍒 🍒", label: "Trois cerises", mult: "×5" },
  { combo: "🍒 🍒", label: "Deux cerises", mult: "×2" },
  { combo: "🍒", label: "Une cerise", mult: "mise rendue" },
];

function Paytable() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4 border-t border-white/10 pt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-sm font-semibold text-white/80 hover:text-gold"
      >
        <span>📖 Guide &amp; table des gains</span>
        <span className="text-xs text-white/50">{open ? "▲ masquer" : "▼ afficher"}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3 text-sm">
          <div>
            <p className="mb-1 font-semibold text-gold">Comment jouer</p>
            <ol className="list-decimal space-y-0.5 pl-5 text-white/75">
              <li>Choisis le montant de ta mise (10, 50, 100 ou 500).</li>
              <li>Clique sur <span className="text-gold">Lancer</span> : les 3 rouleaux tournent.</li>
              <li>Tu gagnes selon la combinaison obtenue (voir ci-dessous).</li>
            </ol>
            <p className="mt-1 text-xs text-white/50">
              Le gain est ta <em>mise × le multiplicateur</em>. Jeu solo : ton solde est
              débité puis crédité immédiatement.
            </p>
          </div>

          <div>
            <p className="mb-1 font-semibold text-gold">Table des gains</p>
            <table className="w-full text-left">
              <thead>
                <tr className="text-xs text-white/50">
                  <th className="py-1">Combinaison</th>
                  <th className="py-1">&nbsp;</th>
                  <th className="py-1 text-right">Gain</th>
                </tr>
              </thead>
              <tbody>
                {PAYTABLE.map((row) => (
                  <tr key={row.label} className="border-t border-white/5">
                    <td className="py-1 text-lg">{row.combo}</td>
                    <td className="py-1 text-xs text-white/60">{row.label}</td>
                    <td className="py-1 text-right font-semibold text-gold">{row.mult}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-white/50">
              Exemple : mise de 100 avec 💎💎💎 → <span className="text-gold">10 000 jetons</span> !
              Une seule 🍒 te rend ta mise (gain net nul).
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
