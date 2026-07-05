"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactElement } from "react";
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
    let key: string;
    if (b.kind === "number" || b.kind === "dozen" || b.kind === "column") {
      key = `${b.kind}:${b.value}`;
    } else if (b.kind === "split" || b.kind === "corner") {
      key = `${b.kind}:${[...(b.numbers ?? [])].sort((a, c) => a - c).join("-")}`;
    } else {
      key = b.kind;
    }
    stakeByCell[key] = (stakeByCell[key] ?? 0) + b.amount;
  }
  const cellStake = (k: string) => stakeByCell[k] ?? 0;

  async function placeBet(kind: RouletteBetKind, value?: number, numbers?: number[]) {
    if (!player || !betting || busy) return;
    setBusy(true);
    setErr(null);
    const { ok, data } = await post("/api/roulette/bet", {
      code,
      playerId: player.id,
      name: player.name,
      kind,
      value,
      numbers,
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
          <span className="tag shrink-0">LOG // Historique</span>
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
            <span className="stat font-bold text-amber">{state.lastResult}</span>{" "}
            {colorOf(state.lastResult) === "green"
              ? "(Zéro !)"
              : colorOf(state.lastResult) === "red"
              ? "(Rouge)"
              : "(Noir)"}
          </p>
        )}

        <p className="mb-2 text-center text-[11px] uppercase tracking-widest text-amber/60">
          // Clique une case (répète pour empiler tes jetons)
        </p>

        <RouletteFelt
          betting={betting}
          busy={busy}
          placeBet={placeBet}
          cellStake={cellStake}
          highlight={state.phase === "result" ? state.lastResult : null}
        />

        {err && <p className="mt-3 text-center text-sm text-red-400">{err}</p>}
      </div>

      {/* Panneau latéral */}
      <div className="flex flex-col gap-4">
        {/* Sélecteur de jeton */}
        <div className="card-surface p-4">
          <h3 className="tag mb-2">01 // Jeton</h3>
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
            Ma mise ce tour : <span className="stat text-amber">{formatChips(myStake)}</span>
          </p>
        </div>

        {/* Actions */}
        <div className="card-surface p-4">
          {betting ? (
            <button onClick={spin} disabled={busy || state.bets.length === 0} className="btn-gold w-full">
              » Lancer la roue
            </button>
          ) : (
            <button onClick={newRound} disabled={busy} className="btn-gold w-full">
              ↻ Nouveau tour
            </button>
          )}
          <p className="mt-2 text-center text-xs text-white/50">
            {secondsLeft != null ? (
              <span className="text-amber">
                {betting ? "Tirage auto dans " : "Nouveau tour dans "}
                <span className="stat">{secondsLeft}s</span>
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
          <h3 className="tag mb-2">
            02 // {state.phase === "result" ? "Résultats" : "Mises en cours"}
          </h3>
          {state.phase === "result" ? (
            <ul className="space-y-1 text-sm">
              {(state.lastPayouts ?? []).length === 0 && (
                <li className="text-white/40">Aucune mise.</li>
              )}
              {(state.lastPayouts ?? []).map((p) => (
                <li key={p.playerId} className="flex justify-between">
                  <span className={p.playerId === player?.id ? "text-amber" : "text-white/80"}>
                    {p.name}
                  </span>
                  <span className={`stat ${p.net >= 0 ? "text-cash" : "text-rl-red"}`}>
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
          <h3 className="tag mb-2">
            03 // À la table ({state.players?.length ?? 0})
          </h3>
          <div className="flex flex-wrap gap-2 text-xs">
            {(state.players ?? []).map((p) => (
              <span
                key={p.id}
                className={`rounded px-2 py-1 ${
                  p.id === player?.id ? "bg-amber/20 text-amber" : "bg-white/10 text-white/80"
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
          <span className={b.playerId === meId ? "text-amber" : "text-white/80"}>
            {b.name} · {betLabel(b)}
          </span>
          <span className="stat text-white/70">{formatChips(b.amount)}</span>
        </li>
      ))}
    </ul>
  );
}

// Géométrie du tapis (positionnement pixel pour placer les zones cheval/carré).
const ZW = 40, CW = 46, CH = 40, GAP = 3, DH = 34, SH = 34;
const X0 = ZW + GAP;
const NUM_W = 12 * CW;
const TOTAL_W = X0 + NUM_W + ZW;
const DOZ_TOP = 3 * CH + GAP;
const SIMPLE_TOP = DOZ_TOP + DH + GAP;
const TOTAL_H = SIMPLE_TOP + SH;
const val = (r: number, c: number) => 3 * (c + 1) - r; // valeur d'une case
const keyOf = (nums: number[]) => [...nums].sort((a, b) => a - b).join("-");

interface Zone {
  left: number;
  top: number;
  w: number;
  h: number;
  kind: "split" | "corner";
  numbers: number[];
}

function buildZones(): Zone[] {
  const zones: Zone[] = [];
  // Chevaux verticaux (entre deux rangées d'une même colonne)
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 12; c++) {
      const cx = X0 + c * CW + CW / 2;
      zones.push({ left: cx - 15, top: (r + 1) * CH - 7, w: 30, h: 14, kind: "split", numbers: [val(r, c), val(r + 1, c)] });
    }
  }
  // Chevaux horizontaux (entre deux colonnes d'une même rangée)
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 11; c++) {
      const bx = X0 + (c + 1) * CW;
      const cy = r * CH + CH / 2;
      zones.push({ left: bx - 7, top: cy - 13, w: 14, h: 26, kind: "split", numbers: [val(r, c), val(r, c + 1)] });
    }
  }
  // Carrés (coin de 4 numéros)
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 11; c++) {
      const x = X0 + (c + 1) * CW;
      const y = (r + 1) * CH;
      zones.push({
        left: x - 9, top: y - 9, w: 18, h: 18, kind: "corner",
        numbers: [val(r, c), val(r + 1, c), val(r, c + 1), val(r + 1, c + 1)],
      });
    }
  }
  return zones;
}

const ZONES = buildZones();

// Tapis de roulette européenne (disposition classique) + mises à cheval/carré.
function RouletteFelt({
  betting,
  busy,
  placeBet,
  cellStake,
  highlight,
}: {
  betting: boolean;
  busy: boolean;
  placeBet: (kind: RouletteBetKind, value?: number, numbers?: number[]) => void;
  cellStake: (k: string) => number;
  highlight: number | null;
}) {
  const d = !betting || busy;
  const numBg = (n: number) => (colorOf(n) === "red" ? "bg-rl-red" : "bg-carbon-800");
  const abs = (left: number, top: number, w: number, h: number) => ({
    position: "absolute" as const,
    left,
    top,
    width: w,
    height: h,
  });

  const numberCells: ReactElement[] = [];
  for (let c = 0; c < 12; c++) {
    for (let r = 0; r < 3; r++) {
      const n = val(r, c);
      const hot = highlight === n;
      numberCells.push(
        <button
          key={n}
          disabled={d}
          onClick={() => placeBet("number", n)}
          style={abs(X0 + c * CW, r * CH, CW - GAP, CH - GAP)}
          className={`relative flex items-center justify-center rounded text-xs font-bold text-white transition hover:brightness-150 disabled:opacity-50 ${numBg(
            n
          )} ${hot ? "z-20 ring-2 ring-amber-hi shadow-glow-amber animate-result" : ""}`}
        >
          {n}
          <ChipBadge amount={cellStake(`number:${n}`)} />
        </button>
      );
    }
  }

  return (
    <>
      <div className="mb-2 overflow-x-auto pb-1">
        <div className="relative" style={{ width: TOTAL_W, height: TOTAL_H, minWidth: TOTAL_W }}>
          {/* Zéro */}
          <button
            disabled={d}
            onClick={() => placeBet("number", 0)}
            style={abs(0, 0, ZW, 3 * CH - GAP)}
            className={`relative flex items-center justify-center rounded bg-cash/80 font-bold text-black hover:brightness-110 disabled:opacity-50 ${
              highlight === 0 ? "z-20 ring-2 ring-amber-hi shadow-glow-amber animate-result" : ""
            }`}
          >
            0
            <ChipBadge amount={cellStake("number:0")} />
          </button>

          {/* Numéros */}
          {numberCells}

          {/* Colonnes 2:1 */}
          {[0, 1, 2].map((r) => {
            const colVal = 3 - r;
            return (
              <button
                key={`col-${colVal}`}
                disabled={d}
                onClick={() => placeBet("column", colVal)}
                style={abs(X0 + NUM_W, r * CH, ZW, CH - GAP)}
                className="relative flex items-center justify-center rounded border border-amber/30 bg-carbon-600 text-[10px] font-bold text-amber hover:brightness-125 disabled:opacity-50"
              >
                2:1
                <ChipBadge amount={cellStake(`column:${colVal}`)} />
              </button>
            );
          })}

          {/* Douzaines */}
          {[1, 2, 3].map((dz) => (
            <FeltCell
              key={`doz-${dz}`}
              style={abs(X0 + (dz - 1) * 4 * CW, DOZ_TOP, 4 * CW - GAP, DH)}
              label={`${dz === 1 ? "1re" : dz + "e"} DOUZAINE`}
              d={d}
              onClick={() => placeBet("dozen", dz)}
              stake={cellStake(`dozen:${dz}`)}
            />
          ))}

          {/* Chances simples */}
          <FeltCell style={abs(X0 + 0 * CW, SIMPLE_TOP, 2 * CW - GAP, SH)} label="1-18" d={d} onClick={() => placeBet("low")} stake={cellStake("low")} />
          <FeltCell style={abs(X0 + 2 * CW, SIMPLE_TOP, 2 * CW - GAP, SH)} label="PAIR" d={d} onClick={() => placeBet("even")} stake={cellStake("even")} />
          <FeltCell style={abs(X0 + 4 * CW, SIMPLE_TOP, 2 * CW - GAP, SH)} label="ROUGE" d={d} onClick={() => placeBet("red")} stake={cellStake("red")} cls="bg-rl-red" />
          <FeltCell style={abs(X0 + 6 * CW, SIMPLE_TOP, 2 * CW - GAP, SH)} label="NOIR" d={d} onClick={() => placeBet("black")} stake={cellStake("black")} cls="bg-carbon-900 border border-white/25" />
          <FeltCell style={abs(X0 + 8 * CW, SIMPLE_TOP, 2 * CW - GAP, SH)} label="IMPAIR" d={d} onClick={() => placeBet("odd")} stake={cellStake("odd")} />
          <FeltCell style={abs(X0 + 10 * CW, SIMPLE_TOP, 2 * CW - GAP, SH)} label="19-36" d={d} onClick={() => placeBet("high")} stake={cellStake("high")} />

          {/* Zones cheval / carré (au-dessus des cases) */}
          {ZONES.map((z, i) => {
            const stake = cellStake(`${z.kind}:${keyOf(z.numbers)}`);
            return (
              <button
                key={i}
                disabled={d}
                title={`${z.kind === "split" ? "Cheval 17:1" : "Carré 8:1"} · ${z.numbers.join("-")}`}
                onClick={() => placeBet(z.kind, undefined, z.numbers)}
                style={{ ...abs(z.left, z.top, z.w, z.h), zIndex: 15 }}
                className="rounded-sm transition hover:bg-amber/40 hover:ring-1 hover:ring-amber disabled:pointer-events-none"
              >
                {stake > 0 && (
                  <span className="absolute left-1/2 top-1/2 z-10 flex h-4 min-w-[1rem] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-amber-hi px-1 text-[8px] font-bold text-black shadow-glow-amber">
                    {formatChips(stake)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <p className="mb-3 text-center text-[10px] text-white/45">
        Astuce : clique <span className="text-amber">entre 2 cases</span> = cheval (17:1) ·{" "}
        <span className="text-amber">au coin de 4</span> = carré (8:1)
      </p>
    </>
  );
}

function FeltCell({
  style,
  label,
  d,
  onClick,
  stake,
  cls,
}: {
  style: CSSProperties;
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
      style={style}
      className={`relative flex items-center justify-center rounded text-[10px] font-bold uppercase tracking-wide text-white transition hover:brightness-125 disabled:opacity-50 ${
        cls ?? "bg-carbon-700 border border-amber/20"
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
    <span className="absolute -right-1 -top-1 z-10 flex min-w-[1.1rem] items-center justify-center rounded-full bg-amber-hi px-1 text-[9px] font-bold text-black shadow-glow-amber">
      {formatChips(amount)}
    </span>
  );
}

function pill(n: number): string {
  const c = colorOf(n);
  if (c === "green") return "bg-cash/80 text-black";
  if (c === "red") return "bg-rl-red";
  return "bg-carbon-800 border border-amber/10";
}
