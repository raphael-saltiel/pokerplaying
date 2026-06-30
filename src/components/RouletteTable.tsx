"use client";

import { useEffect, useRef, useState } from "react";
import { usePlayer } from "@/components/PlayerProvider";
import { post } from "@/lib/client";
import { formatChips } from "@/lib/format";
import { colorOf, betLabel } from "@/lib/games/roulette";
import type { RouletteBet, RouletteBetKind, RouletteState } from "@/lib/types";

const CHIPS = [10, 50, 100, 500, 1000];

const NUMBERS = Array.from({ length: 37 }, (_, i) => i); // 0..36

export function RouletteTable({ code, state }: { code: string; state: RouletteState }) {
  const { player, setBalance } = usePlayer();
  const [chip, setChip] = useState(50);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const joined = useRef(false);

  // Présence : on s'annonce une fois.
  useEffect(() => {
    if (!player || joined.current) return;
    joined.current = true;
    post("/api/roulette/join", { code, playerId: player.id, name: player.name });
  }, [player, code]);

  const betting = state.phase === "betting";
  const myBets = state.bets.filter((b) => b.playerId === player?.id);
  const myStake = myBets.reduce((s, b) => s + b.amount, 0);

  async function placeBet(kind: RouletteBetKind, value?: number) {
    if (!player || !betting || busy) return;
    setBusy(true);
    setErr(null);
    const { ok, data } = await post("/api/roulette/bet", {
      code,
      playerId: player.id,
      name: player.name,
      kind,
      value,
      amount: chip,
    });
    if (!ok) setErr(data.error ?? "Mise refusée.");
    if (typeof data.balance === "number") setBalance(data.balance);
    setBusy(false);
  }

  async function spin() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    const { ok, data } = await post("/api/roulette/spin", { code });
    if (!ok) setErr(data.error ?? "Erreur");
    setBusy(false);
  }

  async function newRound() {
    setBusy(true);
    await post("/api/roulette/new", { code });
    setBusy(false);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      {/* Plateau */}
      <div className="card-surface p-4">
        {/* Historique + résultat */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1">
            {state.history.length === 0 && (
              <span className="text-sm text-white/40">Aucun tirage pour l&apos;instant</span>
            )}
            {state.history.map((n, i) => (
              <span
                key={i}
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${pill(n)}`}
              >
                {n}
              </span>
            ))}
          </div>
        </div>

        {state.phase === "result" && state.lastResult !== null && (
          <div key={state.spinId} className="animate-spin-num mb-4 text-center">
            <div
              className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full text-3xl font-extrabold ${pill(
                state.lastResult
              )}`}
            >
              {state.lastResult}
            </div>
            <p className="mt-2 text-sm text-white/70">
              {colorOf(state.lastResult) === "green"
                ? "Zéro !"
                : colorOf(state.lastResult) === "red"
                ? "Rouge"
                : "Noir"}
            </p>
          </div>
        )}

        {/* Grille des numéros */}
        <div className="mb-3 grid grid-cols-[auto_1fr] gap-2">
          <button
            disabled={!betting || busy}
            onClick={() => placeBet("number", 0)}
            className="flex w-9 items-center justify-center rounded bg-felt-light font-bold text-white hover:brightness-110 disabled:opacity-50"
          >
            0
          </button>
          <div className="grid grid-cols-12 gap-1">
            {NUMBERS.slice(1).map((n) => (
              <button
                key={n}
                disabled={!betting || busy}
                onClick={() => placeBet("number", n)}
                className={`flex h-8 items-center justify-center rounded text-xs font-bold text-white hover:brightness-125 disabled:opacity-50 ${pill(
                  n
                )}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Mises extérieures */}
        <div className="grid grid-cols-3 gap-1 text-xs font-semibold sm:text-sm">
          <Outside label="1ère 12" onClick={() => placeBet("dozen", 1)} d={!betting || busy} />
          <Outside label="2e 12" onClick={() => placeBet("dozen", 2)} d={!betting || busy} />
          <Outside label="3e 12" onClick={() => placeBet("dozen", 3)} d={!betting || busy} />
          <Outside label="Manque 1-18" onClick={() => placeBet("low")} d={!betting || busy} />
          <Outside label="Pair" onClick={() => placeBet("even")} d={!betting || busy} />
          <Outside label="Impair" onClick={() => placeBet("odd")} d={!betting || busy} />
          <Outside
            label="Rouge"
            onClick={() => placeBet("red")}
            d={!betting || busy}
            cls="bg-red-700/70"
          />
          <Outside
            label="Noir"
            onClick={() => placeBet("black")}
            d={!betting || busy}
            cls="bg-black/70"
          />
          <Outside label="Passe 19-36" onClick={() => placeBet("high")} d={!betting || busy} />
        </div>

        {err && <p className="mt-3 text-center text-sm text-red-400">{err}</p>}
      </div>

      {/* Panneau latéral */}
      <div className="flex flex-col gap-4">
        {/* Sélecteur de jeton */}
        <div className="card-surface p-4">
          <h3 className="mb-2 text-sm font-semibold text-white/80">Jeton</h3>
          <div className="flex flex-wrap gap-2">
            {CHIPS.map((c) => (
              <button
                key={c}
                onClick={() => setChip(c)}
                className={chip === c ? "btn-gold px-3 py-1 text-sm" : "btn-dark px-3 py-1 text-sm"}
              >
                {c}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-white/60">
            Ma mise ce tour : <span className="text-gold">{formatChips(myStake)}</span>
          </p>
        </div>

        {/* Actions */}
        <div className="card-surface p-4">
          {betting ? (
            <button onClick={spin} disabled={busy || state.bets.length === 0} className="btn-gold w-full">
              🎡 Lancer la roue
            </button>
          ) : (
            <button onClick={newRound} disabled={busy} className="btn-gold w-full">
              ↻ Nouveau tour
            </button>
          )}
          <p className="mt-2 text-center text-xs text-white/50">
            {betting ? "Tout le monde peut lancer la roue." : "Tour terminé."}
          </p>
        </div>

        {/* Mises en cours / gains */}
        <div className="card-surface p-4">
          <h3 className="mb-2 text-sm font-semibold text-white/80">
            {state.phase === "result" ? "Résultats" : "Mises en cours"}
          </h3>
          {state.phase === "result" ? (
            <ul className="space-y-1 text-sm">
              {(state.lastPayouts ?? []).length === 0 && (
                <li className="text-white/40">Aucune mise.</li>
              )}
              {(state.lastPayouts ?? []).map((p) => (
                <li key={p.playerId} className="flex justify-between">
                  <span className={p.playerId === player?.id ? "text-gold" : "text-white/80"}>
                    {p.name}
                  </span>
                  <span className={p.net >= 0 ? "text-emerald-400" : "text-red-400"}>
                    {p.net >= 0 ? "+" : ""}
                    {formatChips(p.net)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <BetList bets={state.bets} meId={player?.id} />
          )}
        </div>

        {/* Joueurs présents */}
        <div className="card-surface p-4">
          <h3 className="mb-2 text-sm font-semibold text-white/80">
            À la table ({state.players?.length ?? 0})
          </h3>
          <div className="flex flex-wrap gap-2 text-xs">
            {(state.players ?? []).map((p) => (
              <span
                key={p.id}
                className={`rounded-full px-2 py-1 ${
                  p.id === player?.id ? "bg-gold/20 text-gold" : "bg-white/10 text-white/80"
                }`}
              >
                {p.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function BetList({ bets, meId }: { bets: RouletteBet[]; meId?: string }) {
  if (bets.length === 0) return <p className="text-sm text-white/40">Aucune mise.</p>;
  return (
    <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
      {bets.map((b) => (
        <li key={b.id} className="flex justify-between">
          <span className={b.playerId === meId ? "text-gold" : "text-white/80"}>
            {b.name} · {betLabel(b)}
          </span>
          <span className="text-white/70">{formatChips(b.amount)}</span>
        </li>
      ))}
    </ul>
  );
}

function Outside({
  label,
  onClick,
  d,
  cls,
}: {
  label: string;
  onClick: () => void;
  d: boolean;
  cls?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={d}
      className={`rounded px-2 py-2 text-white hover:brightness-125 disabled:opacity-50 ${
        cls ?? "bg-felt"
      }`}
    >
      {label}
    </button>
  );
}

function pill(n: number): string {
  const c = colorOf(n);
  if (c === "green") return "bg-felt-light";
  if (c === "red") return "bg-red-700";
  return "bg-black/80";
}
