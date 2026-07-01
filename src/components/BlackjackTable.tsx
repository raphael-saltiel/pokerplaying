"use client";

import { useEffect, useRef, useState } from "react";
import { usePlayer } from "@/components/PlayerProvider";
import { PlayingCard } from "@/components/PlayingCard";
import { post } from "@/lib/client";
import { formatChips } from "@/lib/format";
import { handTotal } from "@/lib/games/cards";
import { legalMoves } from "@/lib/games/blackjack";
import { fireConfetti } from "@/lib/confetti";
import type { BJHand, BlackjackState, Seat } from "@/lib/types";

const CHIPS = [50, 100, 250, 500];

export function BlackjackTable({ code, state: raw }: { code: string; state: BlackjackState }) {
  const state: BlackjackState = {
    ...raw,
    // Normalisation : garantit `hands` sur chaque siège (robuste aux anciens
    // salons créés avant la refonte).
    seats: (raw.seats ?? []).map((s) =>
      s ? { ...s, hands: s.hands ?? [], insurance: s.insurance ?? 0 } : null
    ),
    dealer: raw.dealer ?? { cards: [], hidden: true },
  };
  const { player, setBalance } = usePlayer();
  const [chip, setChip] = useState(100);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [autoRebet, setAutoRebet] = useState(true);
  const [, setTick] = useState(0);
  const firedRef = useRef<number | null>(null);
  const lastBetRef = useRef(0);
  const autoBetRoundRef = useRef(-1);

  useEffect(() => {
    if (state.deadline == null) {
      firedRef.current = null;
      return;
    }
    const id = setInterval(() => {
      setTick((t) => t + 1);
      if (Date.now() >= state.deadline! && firedRef.current !== state.deadline) {
        firedRef.current = state.deadline!;
        post("/api/blackjack/advance", { code });
      }
    }, 300);
    return () => clearInterval(id);
  }, [state.deadline, code]);

  const secondsLeft =
    state.deadline != null ? Math.max(0, Math.ceil((state.deadline - Date.now()) / 1000)) : null;

  const mySeatIndex = state.seats.findIndex((s) => s?.playerId === player?.id);
  const mySeat = mySeatIndex >= 0 ? state.seats[mySeatIndex] : null;
  const isMyTurn =
    state.phase === "playing" &&
    state.turnSeat != null &&
    state.seats[state.turnSeat]?.playerId === player?.id;
  const anyBet = state.seats.some((s) => s && s.baseBet > 0);
  const moves = isMyTurn ? legalMoves(state, mySeatIndex) : null;
  const needsInsurance =
    state.phase === "insurance" && mySeat && mySeat.hands.length > 0 && !mySeat.insuranceDecided;

  // Mémorise la dernière mise placée.
  useEffect(() => {
    if (mySeat && mySeat.baseBet > 0) lastBetRef.current = mySeat.baseBet;
  }, [mySeat?.baseBet]);

  // Confettis si je gagne net au paiement (une fois par tour).
  const confettiRoundRef = useRef(-1);
  useEffect(() => {
    if (state.phase !== "payout" || !mySeat) return;
    if (confettiRoundRef.current === state.round) return;
    confettiRoundRef.current = state.round;
    const net =
      mySeat.hands.reduce((s, h) => s + h.payout, 0) +
      (mySeat.insuranceResult === "win" ? mySeat.insurance * 2 : mySeat.insuranceResult === "lose" ? -mySeat.insurance : 0);
    if (net > 0) fireConfetti();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.round]);

  // Mise automatique : rejoue la même mise au début de chaque nouveau tour.
  useEffect(() => {
    if (!autoRebet || state.phase !== "betting" || !player || !mySeat) return;
    if (mySeat.baseBet > 0) return; // mise déjà placée ce tour
    if (lastBetRef.current <= 0) return; // aucune mise précédente
    if (autoBetRoundRef.current === state.round) return; // déjà rejoué ce tour
    autoBetRoundRef.current = state.round;
    post("/api/blackjack/bet", { code, playerId: player.id, amount: lastBetRef.current }).then(
      ({ ok, data }) => {
        if (ok && typeof data.balance === "number") setBalance(data.balance);
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRebet, state.phase, state.round, mySeat?.baseBet, player?.id, code]);

  async function call(url: string, body: any) {
    setBusy(true);
    setErr(null);
    const { ok, data } = await post(url, body);
    if (!ok) setErr(data.error ?? "Action refusée.");
    if (typeof data.balance === "number") setBalance(data.balance);
    setBusy(false);
  }

  const dealerTotal = state.dealer.hidden
    ? handTotal(state.dealer.cards.slice(0, 1)).total
    : handTotal(state.dealer.cards).total;

  const phaseLabel =
    secondsLeft == null
      ? null
      : state.phase === "betting"
      ? `Distribution dans ${secondsLeft}s`
      : state.phase === "insurance"
      ? `Assurance — ${secondsLeft}s`
      : state.phase === "playing"
      ? `Tour auto dans ${secondsLeft}s`
      : `Nouveau tour dans ${secondsLeft}s`;

  return (
    <div className="card-surface p-4">
      {/* Message / phase */}
      <div className="mb-4 flex flex-col items-center gap-1 text-center">
        <span className="rounded-full bg-black/40 px-4 py-1 text-sm text-gold">{state.message}</span>
        {phaseLabel && <span className="text-xs text-white/60">{phaseLabel}</span>}
      </div>

      {/* Croupier */}
      <div className="mb-6 flex flex-col items-center">
        <div className="mb-1 text-xs uppercase tracking-wide text-white/50">Croupier</div>
        <div className="flex gap-1.5">
          {state.dealer.cards.length === 0 && <div className="playing-card back opacity-30" />}
          {state.dealer.cards.map((c, i) => {
            const revealed = i === 1 && !state.dealer.hidden;
            return (
              <div key={i} className={revealed ? "animate-flip" : ""}>
                <PlayingCard card={c} hidden={state.dealer.hidden && i === 1} />
              </div>
            );
          })}
        </div>
        {state.dealer.cards.length > 0 && (
          <div className="mt-1 text-sm font-semibold text-white/80">
            {dealerTotal}
            {state.dealer.hidden ? " +" : ""}
          </div>
        )}
      </div>

      {/* Places */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {state.seats.map((seat, i) => (
          <SeatView
            key={i}
            seat={seat}
            index={i}
            isMe={seat?.playerId === player?.id}
            isTurnSeat={state.phase === "playing" && state.turnSeat === i}
            turnHand={state.turnSeat === i ? state.turnHand : -1}
            phase={state.phase}
            canSit={state.phase === "betting" && !seat && mySeatIndex < 0}
            onSit={() => call("/api/blackjack/sit", { code, playerId: player!.id, name: player!.name, seat: i })}
            busy={busy}
          />
        ))}
      </div>

      {err && <p className="mb-3 text-center text-sm text-red-400">{err}</p>}

      {/* Contrôles */}
      <div className="border-t border-white/10 pt-4">
        {/* Assurance */}
        {needsInsurance && (
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm text-white/80">
              Le croupier montre un As. Assurance ({formatChips(Math.floor(mySeat!.hands[0].bet / 2))}) ?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  call("/api/blackjack/insurance", {
                    code,
                    playerId: player!.id,
                    amount: Math.floor(mySeat!.hands[0].bet / 2),
                  })
                }
                disabled={busy}
                className="btn-gold"
              >
                Prendre l&apos;assurance
              </button>
              <button
                onClick={() => call("/api/blackjack/insurance", { code, playerId: player!.id, amount: 0 })}
                disabled={busy}
                className="btn-ghost"
              >
                Non merci
              </button>
            </div>
          </div>
        )}

        {state.phase === "insurance" && !needsInsurance && (
          <p className="text-center text-sm text-white/60">En attente des autres joueurs…</p>
        )}

        {state.phase === "betting" && (
          <div className="flex flex-col items-center gap-3">
            {mySeat ? (
              <>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <span className="text-sm text-white/70">Jeton :</span>
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
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    onClick={() => call("/api/blackjack/bet", { code, playerId: player!.id, amount: chip })}
                    disabled={busy}
                    className="btn-gold"
                  >
                    + Miser {chip}
                  </button>
                  <button
                    onClick={() => call("/api/blackjack/leave", { code, playerId: player!.id })}
                    disabled={busy}
                    className="btn-ghost"
                  >
                    Quitter la place
                  </button>
                </div>
                {/* Mises rapides */}
                <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
                  <span className="text-white/50">Rapide :</span>
                  {[100, 250, 500, 1000].map((amt) => (
                    <button
                      key={amt}
                      onClick={() => call("/api/blackjack/bet", { code, playerId: player!.id, amount: amt })}
                      disabled={busy}
                      className="btn-dark px-3 py-1"
                    >
                      +{amt}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-white/60">
                  Ta mise : <span className="text-gold">{formatChips(mySeat.baseBet)}</span>
                </p>
                <label className="flex items-center gap-2 text-xs text-white/70">
                  <input
                    type="checkbox"
                    checked={autoRebet}
                    onChange={(e) => setAutoRebet(e.target.checked)}
                    className="accent-gold"
                  />
                  Mise automatique (rejoue la même mise à chaque tour)
                </label>
              </>
            ) : (
              <p className="text-sm text-white/70">Clique sur une place libre pour t&apos;asseoir.</p>
            )}
            <button
              onClick={() => call("/api/blackjack/deal", { code })}
              disabled={busy || !anyBet}
              className="btn-gold mt-1 w-full max-w-xs"
            >
              🃏 Distribuer
            </button>
          </div>
        )}

        {state.phase === "playing" && (
          <div className="flex flex-col items-center gap-2">
            {isMyTurn && moves ? (
              <div className="flex flex-wrap justify-center gap-2">
                <button onClick={() => call("/api/blackjack/action", { code, playerId: player!.id, action: "hit" })} disabled={busy} className="btn-gold">
                  Tirer
                </button>
                <button onClick={() => call("/api/blackjack/action", { code, playerId: player!.id, action: "stand" })} disabled={busy} className="btn-dark">
                  Rester
                </button>
                {moves.canDouble && (
                  <button onClick={() => call("/api/blackjack/action", { code, playerId: player!.id, action: "double" })} disabled={busy} className="btn-ghost">
                    Doubler
                  </button>
                )}
                {moves.canSplit && (
                  <button onClick={() => call("/api/blackjack/action", { code, playerId: player!.id, action: "split" })} disabled={busy} className="btn-ghost">
                    Séparer
                  </button>
                )}
                {moves.canSurrender && (
                  <button onClick={() => call("/api/blackjack/action", { code, playerId: player!.id, action: "surrender" })} disabled={busy} className="btn-ghost">
                    Abandonner
                  </button>
                )}
              </div>
            ) : (
              <p className="text-sm text-white/60">
                {state.turnSeat != null ? `Au tour de ${state.seats[state.turnSeat]?.name}…` : "Le croupier joue…"}
              </p>
            )}
          </div>
        )}

        {state.phase === "payout" && (
          <div className="flex flex-col items-center gap-2">
            <button onClick={() => call("/api/blackjack/leave", { code, playerId: player!.id })} disabled={busy || !mySeat} className="btn-ghost text-xs">
              Quitter la table
            </button>
            <p className="text-xs text-white/50">Nouveau tour automatique…</p>
          </div>
        )}
      </div>
    </div>
  );
}

function SeatView({
  seat,
  index,
  isMe,
  isTurnSeat,
  turnHand,
  phase,
  canSit,
  onSit,
  busy,
}: {
  seat: Seat | null;
  index: number;
  isMe: boolean;
  isTurnSeat: boolean;
  turnHand: number;
  phase: BlackjackState["phase"];
  canSit: boolean;
  onSit: () => void;
  busy: boolean;
}) {
  if (!seat) {
    return (
      <button
        onClick={canSit ? onSit : undefined}
        disabled={!canSit || busy}
        className={`flex min-h-[13rem] flex-col items-center justify-center rounded-xl border border-dashed text-sm ${
          canSit ? "border-gold/50 text-gold hover:bg-gold/10" : "border-white/10 text-white/30"
        }`}
      >
        {canSit ? "+ S'asseoir" : `Place ${index + 1}`}
      </button>
    );
  }

  // Résultat net du siège (pour le glow win/lose au paiement).
  const net =
    phase === "payout"
      ? seat.hands.reduce((s, h) => s + h.payout, 0) +
        (seat.insuranceResult === "win" ? seat.insurance * 2 : seat.insuranceResult === "lose" ? -seat.insurance : 0)
      : null;
  const borderCls = isTurnSeat
    ? "turn-active border-neon-cyan"
    : net != null
    ? net > 0
      ? "border-neon-green shadow-glow-green"
      : net < 0
      ? "border-[#ff1f5a] shadow-[0_0_18px_rgba(255,31,90,0.45)]"
      : "border-white/30"
    : isMe
    ? "border-neon-cyan/40"
    : "border-white/15";

  return (
    <div className={`relative flex min-h-[13rem] flex-col items-center justify-between rounded-xl border p-3 ${borderCls} bg-black/30`}>
      {net != null && net !== 0 && (
        <span
          className={`animate-result absolute -top-2 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-[10px] font-bold ${
            net > 0 ? "bg-neon-green text-black" : "bg-[#ff1f5a] text-white"
          }`}
        >
          {net > 0 ? `+${formatChips(net)}` : formatChips(net)}
        </span>
      )}
      <div className="text-center">
        <div className={`text-sm font-semibold ${isMe ? "text-gold" : "text-white/90"}`}>{seat.name}</div>
        {phase === "betting" ? (
          <div className="text-xs text-white/60">{formatChips(seat.baseBet)} jetons</div>
        ) : seat.insurance > 0 ? (
          <div className="text-[10px] text-white/50">
            assur. {formatChips(seat.insurance)}
            {seat.insuranceResult === "win" && <span className="text-emerald-400"> ✓</span>}
            {seat.insuranceResult === "lose" && <span className="text-red-400"> ✗</span>}
          </div>
        ) : null}
      </div>

      {/* Mains */}
      <div className="flex flex-1 flex-wrap items-center justify-center gap-2 overflow-hidden">
        {seat.hands.length === 0 && phase !== "betting" && (
          <span className="text-[11px] text-white/40">sans mise</span>
        )}
        {seat.hands.map((h, hi) => (
          <HandView
            key={hi}
            hand={h}
            active={isTurnSeat && turnHand === hi}
            compact={seat.hands.length > 1}
          />
        ))}
      </div>
    </div>
  );
}

function HandView({ hand, active, compact }: { hand: BJHand; active: boolean; compact: boolean }) {
  const total = handTotal(hand.cards).total;
  return (
    <div className={`flex flex-col items-center rounded-lg p-1 ${active ? "bg-gold/15 ring-1 ring-gold" : ""}`}>
      <div className={`flex justify-center ${compact ? "gap-0.5" : "gap-1"}`}>
        {hand.cards.map((c, i) =>
          compact ? (
            <div key={i} style={{ transform: "scale(0.62)", transformOrigin: "top", margin: "-2px -7px" }}>
              <PlayingCard card={c} />
            </div>
          ) : (
            <PlayingCard key={i} card={c} />
          )
        )}
      </div>
      <div className="mt-1 text-center text-xs">
        {hand.cards.length > 0 && <span className="font-bold text-white/80">{total}</span>}
        {hand.bet > 0 && <span className="ml-1 text-white/40">({formatChips(hand.bet)})</span>}
        {hand.result && <span className={`ml-1 ${resultColor(hand.result)}`}>{resultLabel(hand.result, hand.payout)}</span>}
        {!hand.result && hand.status === "blackjack" && <span className="ml-1 text-gold">BJ</span>}
        {!hand.result && hand.status === "bust" && <span className="ml-1 text-red-400">Saute</span>}
      </div>
    </div>
  );
}

function resultColor(r: NonNullable<BJHand["result"]>): string {
  if (r === "lose" || r === "surrender") return "text-red-400";
  if (r === "push") return "text-white/60";
  return "text-emerald-400";
}
function resultLabel(r: NonNullable<BJHand["result"]>, payout: number): string {
  if (r === "blackjack") return `BJ +${formatChips(payout)}`;
  if (r === "win") return `+${formatChips(payout)}`;
  if (r === "push") return "Égalité";
  if (r === "surrender") return "Abandon";
  return `${formatChips(payout)}`;
}
