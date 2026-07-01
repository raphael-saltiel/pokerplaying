"use client";

import { useEffect, useRef, useState } from "react";
import { usePlayer } from "@/components/PlayerProvider";
import { post } from "@/lib/client";
import { formatChips } from "@/lib/format";
import { colorOf, betLabel } from "@/lib/games/roulette";
import { RouletteWheel } from "@/components/RouletteWheel";
import { fireConfetti } from "@/lib/confetti";
import type { RouletteBet, RouletteBetKind, RouletteState } from "@/lib/types";

const CHIPS = [10, 50, 100, 500, 1000];

export function RouletteTable({ code, state: raw }: { code: string; state: RouletteState }) {
  // Filet de sécurité : on garantit que les collections existent toujours.
  const state: RouletteState = {
    ...raw,
    bets: raw.bets ?? [],
    history: raw.history ?? [],
    players: raw.players ?? [],
    lastPayouts: raw.lastPayouts ?? [],
  };
  const { player, setBalance } = usePlayer();
  const [chip, setChip] = useState(50);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const joined = useRef(false);
  const firedRef = useRef<number | null>(null);

  // Présence : on s'annonce une fois.
  useEffect(() => {
    if (!player || joined.current) return;
    joined.current = true;
    post("/api/roulette/join", { code, playerId: player.id, name: player.name });
  }, [player, code]);

  // Minuteur : tirage auto / nouveau tour auto quand l'échéance est atteinte.
  useEffect(() => {
    if (state.deadline == null) {
      firedRef.current = null;
      return;
    }
    const id = setInterval(() => {
      setTick((t) => t + 1);
      if (Date.now() >= state.deadline! && firedRef.current !== state.deadline) {
        firedRef.current = state.deadline!;
        post("/api/roulette/advance", { code });
      }
    }, 300);
    return () => clearInterval(id);
  }, [state.deadline, code]);

  const secondsLeft =
    state.deadline != null ? Math.max(0, Math.ceil((state.deadline - Date.now()) / 1000)) : null;

  // Confettis si je gagne au tirage (une fois par spin).
  const confettiSpinRef = useRef(-1);
  useEffect(() => {
    if (state.phase !== "result") return;
    if (confettiSpinRef.current === state.spinId) return;
    confettiSpinRef.current = state.spinId;
    const mine = (state.lastPayouts ?? []).find((p) => p.playerId === player?.id);
    if (mine && mine.net > 0) fireConfetti();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.spinId, player?.id]);

  const betting = state.phase === "betting";
  const myBets = state.bets.filter((b) => b.playerId === player?.id);
  const myStake = myBets.reduce((s, b) => s + b.amount, 0);

  // Montant que J'AI empilé sur chaque case (pour l'indicateur de mise rapide).
  const stakeByCell: Record<string, number> = {};
  for (const b of myBets) {
    const key =
      b.kind === "number" || b.kind === "dozen" || b.kind === "column"
        ? `${b.kind}:${b.value}`
        : b.kind;
    stakeByCell[key] = (stakeByCell[key] ?? 0) + b.amount;
  }
  const cellStake = (k: string) => stakeByCell[k] ?? 0;

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
        {/* Historique permanent + résultat */}
        <div className="mb-4 flex items-center gap-3">
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest text-neon-magenta/70">
            Historique
          </span>
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

        {/* Roue animée */}
        <RouletteWheel result={state.lastResult} spinId={state.spinId} />
        {state.phase === "result" && state.lastResult !== null && (
          <p className="mb-4 text-center text-sm text-white/80">
            Résultat :{" "}
            <span className="font-bold text-gold">{state.lastResult}</span>{" "}
            {colorOf(state.lastResult) === "green"
              ? "(Zéro !)"
              : colorOf(state.lastResult) === "red"
              ? "(Rouge)"
              : "(Noir)"}
          </p>
        )}

        <p className="mb-2 text-center text-[11px] uppercase tracking-widest text-neon-cyan/60">
          Clique une case (répète pour empiler tes jetons)
        </p>

        <RouletteFelt
          betting={betting}
          busy={busy}
          placeBet={placeBet}
          cellStake={cellStake}
        />

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
            {secondsLeft != null ? (
              <span className="text-gold">
                {betting
                  ? `Tirage auto dans ${secondsLeft}s`
                  : `Nouveau tour dans ${secondsLeft}s`}
              </span>
            ) : betting ? (
              "Placez vos mises pour démarrer le décompte."
            ) : (
              "Tour terminé."
            )}
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

// Tapis de roulette européenne : 0 + 3×12 numéros, colonnes 2:1, douzaines,
// chances simples. Disposition classique.
function RouletteFelt({
  betting,
  busy,
  placeBet,
  cellStake,
}: {
  betting: boolean;
  busy: boolean;
  placeBet: (kind: RouletteBetKind, value?: number) => void;
  cellStake: (k: string) => number;
}) {
  const d = !betting || busy;
  const cols = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const rows = [0, 1, 2]; // haut, milieu, bas
  const numBg = (n: number) => (colorOf(n) === "red" ? "bg-[#e01e5a]" : "bg-ink-800");

  return (
    <div className="mb-3 overflow-x-auto pb-1">
      <div
        className="grid gap-1"
        style={{
          gridTemplateColumns: "2.4rem repeat(12, minmax(1.7rem, 1fr)) 2.8rem",
          minWidth: "580px",
        }}
      >
        {/* Zéro */}
        <button
          disabled={d}
          onClick={() => placeBet("number", 0)}
          style={{ gridColumn: 1, gridRow: "1 / span 3" }}
          className="relative flex items-center justify-center rounded bg-neon-green/80 font-bold text-black hover:brightness-110 disabled:opacity-50"
        >
          0
          <ChipBadge amount={cellStake("number:0")} />
        </button>

        {/* Numéros 1-36 */}
        {cols.flatMap((c) =>
          rows.map((r) => {
            const n = 3 * (c + 1) - r;
            return (
              <button
                key={n}
                disabled={d}
                onClick={() => placeBet("number", n)}
                style={{ gridColumn: c + 2, gridRow: r + 1 }}
                className={`relative flex h-9 items-center justify-center rounded text-xs font-bold text-white transition hover:brightness-150 disabled:opacity-50 ${numBg(
                  n
                )}`}
              >
                {n}
                <ChipBadge amount={cellStake(`number:${n}`)} />
              </button>
            );
          })
        )}

        {/* Colonnes 2:1 */}
        {rows.map((r) => {
          const colVal = 3 - r; // haut->3, milieu->2, bas->1
          return (
            <button
              key={`col-${colVal}`}
              disabled={d}
              onClick={() => placeBet("column", colVal)}
              style={{ gridColumn: 14, gridRow: r + 1 }}
              className="relative flex items-center justify-center rounded border border-neon-cyan/30 bg-ink-600 text-[10px] font-bold text-neon-cyan hover:brightness-125 disabled:opacity-50"
            >
              2:1
              <ChipBadge amount={cellStake(`column:${colVal}`)} />
            </button>
          );
        })}

        {/* Douzaines */}
        <FeltCell col="2 / span 4" row={4} label="1re DOUZAINE" d={d} onClick={() => placeBet("dozen", 1)} stake={cellStake("dozen:1")} />
        <FeltCell col="6 / span 4" row={4} label="2e DOUZAINE" d={d} onClick={() => placeBet("dozen", 2)} stake={cellStake("dozen:2")} />
        <FeltCell col="10 / span 4" row={4} label="3e DOUZAINE" d={d} onClick={() => placeBet("dozen", 3)} stake={cellStake("dozen:3")} />

        {/* Chances simples */}
        <FeltCell col="2 / span 2" row={5} label="1-18" d={d} onClick={() => placeBet("low")} stake={cellStake("low")} />
        <FeltCell col="4 / span 2" row={5} label="PAIR" d={d} onClick={() => placeBet("even")} stake={cellStake("even")} />
        <FeltCell col="6 / span 2" row={5} label="ROUGE" d={d} onClick={() => placeBet("red")} stake={cellStake("red")} cls="bg-[#e01e5a]" />
        <FeltCell col="8 / span 2" row={5} label="NOIR" d={d} onClick={() => placeBet("black")} stake={cellStake("black")} cls="bg-ink-900 border border-white/25" />
        <FeltCell col="10 / span 2" row={5} label="IMPAIR" d={d} onClick={() => placeBet("odd")} stake={cellStake("odd")} />
        <FeltCell col="12 / span 2" row={5} label="19-36" d={d} onClick={() => placeBet("high")} stake={cellStake("high")} />
      </div>
    </div>
  );
}

function FeltCell({
  col,
  row,
  label,
  d,
  onClick,
  stake,
  cls,
}: {
  col: string;
  row: number;
  label: string;
  d: boolean;
  onClick: () => void;
  stake: number;
  cls?: string;
}) {
  return (
    <button
      disabled={d}
      onClick={onClick}
      style={{ gridColumn: col, gridRow: row }}
      className={`relative flex h-9 items-center justify-center rounded text-[10px] font-bold uppercase tracking-wide text-white transition hover:brightness-125 disabled:opacity-50 ${
        cls ?? "bg-ink-700 border border-neon-cyan/25"
      }`}
    >
      {label}
      <ChipBadge amount={stake} />
    </button>
  );
}

// Jeton empilé sur une case (indicateur de mise rapide).
function ChipBadge({ amount }: { amount: number }) {
  if (!amount) return null;
  return (
    <span className="absolute -right-1 -top-1 z-10 flex min-w-[1.1rem] items-center justify-center rounded-full bg-neon-yellow px-1 text-[9px] font-bold text-black shadow-[0_0_8px_rgba(244,255,0,0.8)]">
      {formatChips(amount)}
    </span>
  );
}

function pill(n: number): string {
  const c = colorOf(n);
  if (c === "green") return "bg-neon-green/80 text-black";
  if (c === "red") return "bg-[#ff1f5a]";
  return "bg-ink-700 border border-neon-cyan/20";
}
