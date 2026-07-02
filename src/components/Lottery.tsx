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
  const [msg, setMsg] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
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
        setLoadErr(null);
        targetRef.current = Date.now() + d.nextDrawIn;
        // confettis si j'ai gagné au dernier tirage (une fois)
        if (d.last && confettiRef.current !== d.last.date) {
          confettiRef.current = d.last.date;
          if (d.last.myTickets.some((t: LastTicket) => t.prize > 0)) fireConfetti({ count: 150 });
        }
      } else {
        setLoadErr(d.error ?? `Erreur ${res.status}`);
      }
    } catch {
      setLoadErr("Réseau indisponible.");
    } finally {
      setLoaded(true);
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
        setMsg("🎟️ Ticket enregistré. Verdict au prochain tirage (minuit UTC).");
        load();
      }
    } catch {
      setErr("Réseau indisponible.");
    } finally {
      setBusy(false);
    }
  }

  // États visibles (au lieu de disparaître en silence si l'API échoue).
  if (!loaded) {
    return (
      <section className="mt-8">
        <h2 className="mb-2 font-display text-2xl font-bold tracking-wide text-amber">
          🎱 Loto quotidien
        </h2>
        <div className="card-surface p-4 text-sm text-white/60">Chargement du loto…</div>
      </section>
    );
  }
  if (loadErr || !data) {
    return (
      <section className="mt-8">
        <h2 className="mb-2 font-display text-2xl font-bold tracking-wide text-amber">
          🎱 Loto quotidien
        </h2>
        <div className="card-surface p-4 text-sm">
          <p className="mb-2 text-red-400">Loto indisponible : {loadErr ?? "aucune donnée"}.</p>
          <p className="text-white/60">
            Vérifie que le schéma SQL a bien été (ré)exécuté dans Supabase (tables{" "}
            <code className="text-amber">lottery_draws</code> et{" "}
            <code className="text-amber">lottery_tickets</code>), puis redéploie.
          </p>
          <button onClick={() => { setLoaded(false); load(); }} className="btn-dark mt-3 text-sm">
            Réessayer
          </button>
        </div>
      </section>
    );
  }

  const prizeRows = Object.entries(data.prizes).sort((a, b) => Number(b[0]) - Number(a[0]));

  return (
    <section className="mt-8">
      <div className="mb-1 flex items-baseline justify-between">
        <h2 className="font-display text-2xl font-bold tracking-wide text-amber">
          🎱 Loto quotidien
        </h2>
        <span className="stat text-sm text-amber">⏳ {fmt(left)}</span>
      </div>
      <p className="tag mb-4">
        LOTO // {data.pick} numéros (1–{data.max}) · {formatChips(data.price)} jetons le ticket ·
        tirage à minuit UTC
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
                      ? "bg-cash text-black shadow-glow-cash"
                      : "bg-carbon-800 text-white/80 hover:bg-carbon-600"
                  }`}
                >
                  {n}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-white/70">
              Sélection : <span className="stat text-amber">{selected.length}/{data.pick}</span>
              {player && (
                <span className="ml-3 text-white/50">
                  Solde : <span className="stat text-amber">{formatChips(player.balance)}</span>
                </span>
              )}
            </span>
            <div className="flex gap-2">
              <button onClick={quickPick} className="btn-dark text-sm">
                🎲 Aléatoire
              </button>
              <button
                onClick={buy}
                disabled={busy || selected.length !== data.pick || !!player && player.balance < data.price}
                className="btn-gold text-sm"
              >
                Valider ({formatChips(data.price)})
              </button>
            </div>
          </div>
          {player && player.balance < data.price && (
            <p className="mt-2 text-sm text-amber-hi">
              Solde insuffisant : il te faut {formatChips(data.price)} jetons par ticket.
            </p>
          )}
          {err && <p className="mt-2 text-sm text-red-400">{err}</p>}
          {msg && !err && <p className="mt-2 text-sm text-cash">{msg}</p>}
        </div>

        {/* Panneau latéral */}
        <div className="flex flex-col gap-4">
          {/* Table des gains */}
          <div className="card-surface p-4">
            <h3 className="tag mb-2">01 // Gains</h3>
            <ul className="space-y-1 font-mono text-xs">
              {prizeRows.map(([m, amt]) => (
                <li key={m} className="flex justify-between">
                  <span className="text-white/70">{m} bons numéros</span>
                  <span className="stat text-cash">{formatChips(amt)}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Mes tickets du jour */}
          <div className="card-surface p-4">
            <h3 className="tag mb-2">
              02 // Mes tickets ({data.myToday.length})
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
              <h3 className="tag mb-2">
                03 // Tirage du {data.last.date}
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
                      <span className={`stat ${t.prize > 0 ? "text-cash" : "text-white/40"}`}>
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
        win ? "bg-cash text-black shadow-glow-cash" : "bg-carbon-700 text-white/80"
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
