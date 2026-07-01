"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePlayer } from "@/components/PlayerProvider";
import { formatChips } from "@/lib/format";
import { fireConfetti } from "@/lib/confetti";

interface LastTicket {
  numbers: number[];
  prize: number;
  matches: number;
}
interface Status {
  today: string;
  nextDrawIn: number;
  price: number;
  pick: number;
  max: number;
  prizes: Record<string, number>;
  myToday: number[][];
  last: { date: string; numbers: number[]; myTickets: LastTicket[] } | null;
}

export function Lottery() {
  const { player, setBalance } = usePlayer();
  const [data, setData] = useState<Status | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [left, setLeft] = useState(0);
  const targetRef = useRef(0);
  const confettiRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (!player) return;
    try {
      const res = await fetch(`/api/lottery/status?playerId=${player.id}`, { cache: "no-store" });
      const d = await res.json();
      if (res.ok) {
        setData(d);
        targetRef.current = Date.now() + d.nextDrawIn;
        // confettis si j'ai gagné au dernier tirage (une fois)
        if (d.last && confettiRef.current !== d.last.date) {
          confettiRef.current = d.last.date;
          if (d.last.myTickets.some((t: LastTicket) => t.prize > 0)) fireConfetti({ count: 150 });
        }
      }
    } catch {
      /* ignore */
    }
  }, [player]);

  useEffect(() => {
    load();
  }, [load]);

  // Décompte jusqu'au prochain tirage.
  useEffect(() => {
    const id = setInterval(() => setLeft(Math.max(0, targetRef.current - Date.now())), 1000);
    return () => clearInterval(id);
  }, []);

  function toggle(n: number) {
    if (!data) return;
    setSelected((s) =>
      s.includes(n) ? s.filter((x) => x !== n) : s.length < data.pick ? [...s, n] : s
    );
  }

  function quickPick() {
    if (!data) return;
    const set = new Set<number>();
    while (set.size < data.pick) set.add(1 + Math.floor(Math.random() * data.max));
    setSelected([...set]);
  }

  async function buy() {
    if (!player || !data || selected.length !== data.pick || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/lottery/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: player.id, name: player.name, numbers: selected }),
      });
      const d = await res.json();
      if (!res.ok) {
        setErr(d.error ?? "Erreur");
      } else {
        setBalance(d.balance);
        setSelected([]);
        load();
      }
    } catch {
      setErr("Réseau indisponible.");
    } finally {
      setBusy(false);
    }
  }

  if (!data) return null;

  const prizeRows = Object.entries(data.prizes).sort((a, b) => Number(b[0]) - Number(a[0]));

  return (
    <section className="mt-8">
      <div className="mb-1 flex items-baseline justify-between">
        <h2 className="font-display text-2xl font-bold tracking-wide text-neon-green">
          🎱 Loto quotidien
        </h2>
        <span className="stat text-sm text-neon-cyan">⏳ {fmt(left)}</span>
      </div>
      <p className="mb-4 text-xs text-white/60">
        Choisis {data.pick} numéros (1–{data.max}) · {formatChips(data.price)} jetons le ticket ·
        tirage chaque jour à minuit (UTC)
      </p>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        {/* Grille de sélection */}
        <div className="card-surface p-4">
          <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10">
            {Array.from({ length: data.max }, (_, i) => i + 1).map((n) => {
              const on = selected.includes(n);
              return (
                <button
                  key={n}
                  onClick={() => toggle(n)}
                  className={`flex h-8 items-center justify-center rounded font-mono text-sm font-bold transition ${
                    on
                      ? "bg-neon-green text-black shadow-glow-green"
                      : "bg-ink-800 text-white/80 hover:bg-ink-600"
                  }`}
                >
                  {n}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-white/70">
              Sélection : <span className="text-neon-green">{selected.length}/{data.pick}</span>
            </span>
            <div className="flex gap-2">
              <button onClick={quickPick} className="btn-dark text-sm">
                🎲 Aléatoire
              </button>
              <button
                onClick={buy}
                disabled={busy || selected.length !== data.pick}
                className="btn-gold text-sm"
              >
                Valider ({formatChips(data.price)})
              </button>
            </div>
          </div>
          {err && <p className="mt-2 text-sm text-red-400">{err}</p>}
        </div>

        {/* Panneau latéral */}
        <div className="flex flex-col gap-4">
          {/* Table des gains */}
          <div className="card-surface p-4">
            <h3 className="mb-2 text-sm font-semibold text-white/80">Gains</h3>
            <ul className="space-y-1 font-mono text-xs">
              {prizeRows.map(([m, amt]) => (
                <li key={m} className="flex justify-between">
                  <span className="text-white/70">{m} bons numéros</span>
                  <span className="text-neon-green">{formatChips(amt)}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Mes tickets du jour */}
          <div className="card-surface p-4">
            <h3 className="mb-2 text-sm font-semibold text-white/80">
              Mes tickets ({data.myToday.length})
            </h3>
            {data.myToday.length === 0 ? (
              <p className="text-xs text-white/40">Aucun ticket pour aujourd&apos;hui.</p>
            ) : (
              <ul className="space-y-1">
                {data.myToday.map((nums, i) => (
                  <li key={i} className="flex flex-wrap gap-1">
                    {nums.map((n) => (
                      <Ball key={n} n={n} />
                    ))}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Dernier tirage */}
          {data.last && (
            <div className="card-surface p-4">
              <h3 className="mb-2 text-sm font-semibold text-white/80">
                Tirage du {data.last.date}
              </h3>
              <div className="mb-2 flex flex-wrap gap-1">
                {data.last.numbers.map((n) => (
                  <Ball key={n} n={n} win />
                ))}
              </div>
              {data.last.myTickets.length > 0 ? (
                <ul className="space-y-1 text-xs">
                  {data.last.myTickets.map((t, i) => (
                    <li key={i} className="flex items-center justify-between">
                      <span className="text-white/60">{t.matches} bons</span>
                      <span className={t.prize > 0 ? "text-neon-green" : "text-white/40"}>
                        {t.prize > 0 ? `+${formatChips(t.prize)}` : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-white/40">Tu n&apos;avais pas joué.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Ball({ n, win }: { n: number; win?: boolean }) {
  return (
    <span
      className={`flex h-6 w-6 items-center justify-center rounded-full font-mono text-xs font-bold ${
        win ? "bg-neon-green text-black shadow-glow-green" : "bg-ink-700 text-white/80"
      }`}
    >
      {n}
    </span>
  );
}

function fmt(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}
