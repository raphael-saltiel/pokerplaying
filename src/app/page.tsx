"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { Gate } from "@/components/Gate";
import { Slots } from "@/components/Slots";
import { ScratchCards } from "@/components/ScratchCards";
import { Lottery } from "@/components/Lottery";
import { Intro } from "@/components/Intro";
import { Logo } from "@/components/Logo";
import { usePlayer } from "@/components/PlayerProvider";
import type { GameType } from "@/lib/types";

export default function Home() {
  return (
    <main className="min-h-screen">
      <Intro />
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
        <Logo size={92} className="mx-auto mb-3 drop-shadow-[0_0_18px_rgba(0,240,255,0.45)]" />
        <p className="mb-4">
          <span className="inline-flex items-center gap-2 rounded-sm border border-burn/45 bg-burn/5 px-3 py-1.5 text-[10px] tracking-[0.2em] text-burn">
            <span className="live-dot" /> CERCLE PRIVÉ // JETONS FICTIFS — ZÉRO ARGENT RÉEL
          </span>
        </p>
        <h1 className="font-display text-4xl font-bold tracking-widest sm:text-6xl">
          <span className="glitch" data-text="DARKPOOL://">
            DARKPOOL<span className="text-amber">://</span>
          </span>
        </h1>
        <p className="mt-3 text-sm text-white/60">
          Ceci n&apos;est pas un casino. <span className="text-amber">C&apos;est le nôtre.</span>
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
      <h2 className="mb-3 font-display text-[13px] font-bold tracking-[0.3em] text-amber">
        ▸ LA SALLE // MODULES
      </h2>
      <div className="grid gap-5 sm:grid-cols-3">
        <GameCard
          index="01"
          title="Poker"
          desc="Texas Hold&apos;em No-Limit. Blindes, mises, abattage, tapis. Jusqu&apos;à 6 joueurs, départ automatique."
          onCreate={() => createTable("poker")}
          loading={busy === "poker"}
        />
        <GameCard
          index="02"
          title="Roulette"
          desc="Misez tous ensemble, une roue partagée. Rouge/noir, numéros, douzaines…"
          onCreate={() => createTable("roulette")}
          loading={busy === "roulette"}
        />
        <GameCard
          index="03"
          title="Blackjack"
          desc="Jusqu&apos;à 5 joueurs à la même table contre le croupier. Tirez, restez, doublez."
          onCreate={() => createTable("blackjack")}
          loading={busy === "blackjack"}
        />
      </div>

      {/* Jeu solo */}
      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        <Slots />
        <div className="card-surface flex flex-col justify-center p-5 text-sm">
          <h3 className="tag mb-3">SYS:// COMMENT JOUER</h3>
          <ol className="list-decimal space-y-1 pl-5 font-mono text-white/65">
            <li>Crée une table (Poker, Roulette ou Blackjack).</li>
            <li>Partage le code à 4 lettres à tes collègues.</li>
            <li>Ils saisissent le code ci-dessus pour te rejoindre.</li>
            <li>Tout le monde voit les mises et résultats en direct.</li>
          </ol>
          <p className="mt-3 font-mono text-white/50">
            Chaque joueur démarre avec <span className="stat">10 000</span> jetons (argent fictif).
          </p>
        </div>
      </div>

      {/* Tickets à gratter */}
      <ScratchCards />

      {/* Loto quotidien */}
      <Lottery />
    </div>
  );
}

function GameCard({
  index,
  title,
  desc,
  onCreate,
  loading,
}: {
  index: string;
  title: string;
  desc: string;
  onCreate: () => void;
  loading: boolean;
}) {
  return (
    <div className="card-surface glitch-hover p-6">
      <p className="tag mb-2">
        {index} // {title.toUpperCase()}
      </p>
      <h2 className="font-display text-2xl font-bold tracking-wide text-amber">{title}</h2>
      <p className="mt-2 min-h-[3rem] text-sm text-white/60">{desc}</p>
      <button onClick={onCreate} disabled={loading} className="btn-gold mt-4 w-full">
        {loading ? "Création…" : "Créer une table"}
      </button>
    </div>
  );
}
