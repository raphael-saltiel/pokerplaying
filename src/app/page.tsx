"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { Gate } from "@/components/Gate";
import { Slots } from "@/components/Slots";
import { usePlayer } from "@/components/PlayerProvider";
import type { GameType } from "@/lib/types";

export default function Home() {
  return (
    <main className="min-h-screen">
      <Header />
      <Gate>
        <Lobby />
      </Gate>
    </main>
  );
}

function Lobby() {
  const { player } = usePlayer();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<GameType | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function createTable(game: GameType) {
    if (!player) return;
    setBusy(game);
    setErr(null);
    try {
      const res = await fetch("/api/table", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game, hostId: player.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      router.push(`/table/${data.code}`);
    } catch (e: any) {
      setErr(e.message);
      setBusy(null);
    }
  }

  function join(e: React.FormEvent) {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (c.length >= 3) router.push(`/table/${c}`);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <section className="mb-8 text-center">
        <h1 className="font-display text-4xl font-black tracking-widest sm:text-6xl">
          <span className="glitch" data-text="CASINO ROYALE">
            CASINO ROYALE
          </span>
        </h1>
        <p className="mt-3 font-mono text-sm uppercase tracking-[0.3em] text-neon-magenta/80">
          // temps réel · multijoueur · néon
        </p>
      </section>

      {/* Rejoindre par code */}
      <form onSubmit={join} className="mx-auto mb-10 flex max-w-md gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="CODE DE LA TABLE"
          maxLength={6}
          className="chip-input flex-1 text-center tracking-widest"
        />
        <button type="submit" className="btn-gold">
          Rejoindre
        </button>
      </form>

      {err && <p className="mb-4 text-center text-red-400">{err}</p>}

      {/* Jeux multijoueurs */}
      <div className="grid gap-5 sm:grid-cols-3">
        <GameCard
          title="♠ Poker"
          desc="Texas Hold'em No-Limit. Blindes, mises, abattage, tapis. Jusqu'à 6 joueurs, départ automatique."
          accent="from-amber-900/40"
          onCreate={() => createTable("poker")}
          loading={busy === "poker"}
        />
        <GameCard
          title="🎡 Roulette"
          desc="Misez tous ensemble, une roue partagée. Rouge/noir, numéros, douzaines…"
          accent="from-red-900/40"
          onCreate={() => createTable("roulette")}
          loading={busy === "roulette"}
        />
        <GameCard
          title="🃏 Blackjack"
          desc="Jusqu'à 5 joueurs à la même table contre le croupier. Tirez, restez, doublez."
          accent="from-emerald-900/40"
          onCreate={() => createTable("blackjack")}
          loading={busy === "blackjack"}
        />
      </div>

      {/* Jeu solo */}
      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        <Slots />
        <div className="card-surface flex flex-col justify-center p-5 text-sm text-white/70">
          <h3 className="mb-2 font-display text-xl text-gold">Comment jouer ?</h3>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Crée une table (Poker, Roulette ou Blackjack).</li>
            <li>Partage le code à 4 lettres à tes collègues.</li>
            <li>Ils saisissent le code ci-dessus pour te rejoindre.</li>
            <li>Tout le monde voit les mises et résultats en direct.</li>
          </ol>
          <p className="mt-3 text-white/50">
            Chaque joueur démarre avec 10 000 jetons (argent fictif).
          </p>
        </div>
      </div>
    </div>
  );
}

function GameCard({
  title,
  desc,
  accent,
  onCreate,
  loading,
}: {
  title: string;
  desc: string;
  accent: string;
  onCreate: () => void;
  loading: boolean;
}) {
  return (
    <div className={`card-surface glitch-hover bg-gradient-to-br ${accent} to-transparent p-6`}>
      <h2 className="font-display text-2xl font-bold tracking-wide text-neon-cyan">{title}</h2>
      <p className="mt-2 min-h-[3rem] text-sm text-white/75">{desc}</p>
      <button onClick={onCreate} disabled={loading} className="btn-gold mt-4 w-full">
        {loading ? "Création…" : "Créer une table"}
      </button>
    </div>
  );
}
