"use client";

import { useEffect, useRef, useState } from "react";
import { usePlayer } from "@/components/PlayerProvider";
import { formatChips } from "@/lib/format";
import { fireConfetti } from "@/lib/confetti";
import { TICKETS, ticketOdds, type NeonColor, type ScratchTicket } from "@/lib/games/scratch";

const COLOR: Record<NeonColor, { text: string; border: string; chip: string; shadow: string }> = {
  cyan: { text: "text-neon-cyan", border: "border-neon-cyan/50", chip: "bg-neon-cyan text-black", shadow: "shadow-glow-cyan" },
  magenta: { text: "text-neon-magenta", border: "border-neon-magenta/50", chip: "bg-neon-magenta text-black", shadow: "shadow-glow-magenta" },
  yellow: { text: "text-neon-yellow", border: "border-neon-yellow/50", chip: "bg-neon-yellow text-black", shadow: "shadow-glow-yellow" },
  green: { text: "text-neon-green", border: "border-neon-green/50", chip: "bg-neon-green text-black", shadow: "shadow-glow-green" },
};

interface ActiveTicket {
  ticket: ScratchTicket;
  grid: number[];
  prize: number;
  balance: number;
}

export function ScratchCards() {
  const { player, setBalance } = usePlayer();
  const [active, setActive] = useState<ActiveTicket | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function buy(ticket: ScratchTicket) {
    if (!player || busyId) return;
    setBusyId(ticket.id);
    setErr(null);
    try {
      const res = await fetch("/api/scratch/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: player.id, ticketId: ticket.id }),
      });
      const data = await res.json();
      setBusyId(null);
      if (!res.ok) {
        setErr(data.error ?? "Erreur");
        return;
      }
      // On débite déjà à l'achat : on met à jour le solde tout de suite.
      setBalance(data.balance);
      setActive({ ticket, grid: data.grid, prize: data.prize, balance: data.balance });
    } catch {
      setBusyId(null);
      setErr("Réseau indisponible.");
    }
  }

  return (
    <section className="mt-8">
      <h2 className="mb-1 font-display text-2xl font-bold tracking-wide text-neon-yellow">
        🎟️ Tickets à gratter
      </h2>
      <p className="mb-4 text-xs text-white/60">
        Jeu solo façon FDJ · résultat pré-tiré, gratte pour révéler · 3 montants identiques = tu gagnes ce montant
      </p>

      {err && <p className="mb-3 text-sm text-red-400">{err}</p>}

      <div className="grid gap-4 sm:grid-cols-3">
        {TICKETS.map((t) => (
          <TicketCard key={t.id} ticket={t} onBuy={() => buy(t)} loading={busyId === t.id} />
        ))}
      </div>

      {active && (
        <ScratchOverlay
          active={active}
          onClose={() => {
            setBalance(active.balance);
            setActive(null);
          }}
        />
      )}
    </section>
  );
}

function TicketCard({ ticket, onBuy, loading }: { ticket: ScratchTicket; onBuy: () => void; loading: boolean }) {
  const c = COLOR[ticket.color];
  const odds = ticketOdds(ticket);
  const jackpot = Math.max(...ticket.prizes.map((p) => p.amount));
  const [showOdds, setShowOdds] = useState(false);

  return (
    <div className={`card-surface border ${c.border} p-4`}>
      <div className="flex items-baseline justify-between">
        <h3 className={`font-display text-lg font-bold ${c.text}`}>{ticket.name}</h3>
        <span className="stat text-sm text-white/70">{formatChips(ticket.price)} ◆</span>
      </div>
      <p className="mb-2 text-xs text-white/60">{ticket.tagline}</p>

      <div className="mb-3 space-y-0.5 font-mono text-[11px] text-white/70">
        <div>
          Jackpot : <span className={c.text}>{formatChips(jackpot)}</span>
        </div>
        <div>Gagnant : 1 sur {odds.oneInN.toFixed(1)}</div>
        <button onClick={() => setShowOdds((s) => !s)} className="text-neon-cyan/70 underline">
          {showOdds ? "masquer les probas" : "voir les probas"}
        </button>
        {showOdds && (
          <ul className="mt-1 space-y-0.5 text-white/60">
            {odds.table.map((row) => (
              <li key={row.amount} className="flex justify-between">
                <span>{formatChips(row.amount)}</span>
                <span>1 sur {Math.round(row.oneInN)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button onClick={onBuy} disabled={loading} className="btn-gold w-full">
        {loading ? "…" : `Acheter & gratter`}
      </button>
    </div>
  );
}

function ScratchOverlay({ active, onClose }: { active: ActiveTicket; onClose: () => void }) {
  const { ticket, grid, prize } = active;
  const [revealed, setRevealed] = useState(false);
  const c = COLOR[ticket.color];

  useEffect(() => {
    if (revealed && prize > 0) fireConfetti({ count: 140 });
  }, [revealed, prize]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className={`card-surface border ${c.border} ${c.shadow} w-full max-w-sm p-5`}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className={`font-display text-xl font-bold ${c.text}`}>{ticket.name}</h3>
          <button onClick={onClose} className="text-white/50 hover:text-white">
            ✕
          </button>
        </div>

        <ScratchCard grid={grid} prize={prize} color={ticket.color} onRevealed={() => setRevealed(true)} />

        <div className="mt-4 min-h-[3rem] text-center">
          {revealed ? (
            prize > 0 ? (
              <div className="animate-result">
                <div className="stat text-3xl font-black text-neon-yellow">
                  🎉 +{formatChips(prize)}
                </div>
                <div className="text-xs text-white/60">Bravo, gain crédité !</div>
              </div>
            ) : (
              <div className="text-lg font-semibold text-white/50">Perdu — retente ta chance !</div>
            )
          ) : (
            <div className="text-xs text-white/50">Gratte la zone pour révéler le résultat…</div>
          )}
        </div>

        <button onClick={onClose} className="btn-dark mt-2 w-full">
          {revealed ? "Fermer" : "Abandonner"}
        </button>
      </div>
    </div>
  );
}

const SIZE = 288; // 3 × 96

function ScratchCard({
  grid,
  prize,
  color,
  onRevealed,
}: {
  grid: number[];
  prize: number;
  color: NeonColor;
  onRevealed: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const done = useRef(false);
  const [revealed, setRevealed] = useState(false);
  const c = COLOR[color];

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    // Feuille à gratter (dégradé métallique néon).
    const g = ctx.createLinearGradient(0, 0, SIZE, SIZE);
    g.addColorStop(0, "#3a2a5e");
    g.addColorStop(0.5, "#7a5ab0");
    g.addColorStop(1, "#2a1a4d");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SIZE, SIZE);
    // Motif holographique
    ctx.strokeStyle = "rgba(0,240,255,0.18)";
    ctx.lineWidth = 2;
    for (let i = -SIZE; i < SIZE; i += 16) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + SIZE, SIZE);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "bold 20px monospace";
    ctx.textAlign = "center";
    ctx.fillText("✦ GRATTE ICI ✦", SIZE / 2, SIZE / 2);
    ctx.globalCompositeOperation = "destination-out";
  }, []);

  function point(e: React.PointerEvent) {
    const cv = canvasRef.current!;
    const r = cv.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * SIZE,
      y: ((e.clientY - r.top) / r.height) * SIZE,
    };
  }

  function scratch(e: React.PointerEvent) {
    if (!drawing.current || done.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = point(e);
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, Math.PI * 2);
    ctx.fill();
  }

  function progress(): number {
    const cv = canvasRef.current!;
    const ctx = cv.getContext("2d")!;
    const data = ctx.getImageData(0, 0, SIZE, SIZE).data;
    let clear = 0;
    let total = 0;
    for (let i = 3; i < data.length; i += 4 * 40) {
      total++;
      if (data[i] === 0) clear++;
    }
    return clear / total;
  }

  function revealAll() {
    if (done.current) return;
    done.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.clearRect(0, 0, SIZE, SIZE);
    setRevealed(true);
    onRevealed();
  }

  function onUp() {
    drawing.current = false;
    if (!done.current && progress() > 0.5) revealAll();
  }

  return (
    <div className="relative mx-auto" style={{ width: SIZE, height: SIZE }}>
      {/* Grille révélée en dessous */}
      <div className="absolute inset-0 grid grid-cols-3 gap-1 rounded-lg bg-ink-900/80 p-1">
        {grid.map((amt, i) => {
          const isWin = revealed && prize > 0 && amt === prize;
          return (
            <div
              key={i}
              className={`flex items-center justify-center rounded font-mono text-sm font-bold ${
                isWin
                  ? `${c.chip} ${c.shadow} animate-result`
                  : "bg-ink-700 text-white/80"
              }`}
            >
              {formatChips(amt)}
            </div>
          );
        })}
      </div>

      {/* Couche à gratter */}
      <canvas
        ref={canvasRef}
        width={SIZE}
        height={SIZE}
        className="absolute inset-0 h-full w-full cursor-grab touch-none rounded-lg"
        onPointerDown={(e) => {
          drawing.current = true;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          scratch(e);
        }}
        onPointerMove={scratch}
        onPointerUp={onUp}
        onPointerLeave={onUp}
      />

      {!revealed && (
        <button
          onClick={revealAll}
          className="absolute -bottom-9 left-1/2 -translate-x-1/2 text-xs text-neon-cyan/70 underline"
        >
          tout révéler
        </button>
      )}
    </div>
  );
}
