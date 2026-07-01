"use client";

import { useEffect, useRef, useState } from "react";
import { usePlayer } from "@/components/PlayerProvider";
import { PlayingCard } from "@/components/PlayingCard";
import { post } from "@/lib/client";
import { formatChips } from "@/lib/format";
import { handTotal } from "@/lib/games/cards";
import { legalMoves } from "@/lib/games/blackjack";
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
  const [, setTick] = useState(0);
  const firedRef = useRef<number | null>(null);

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
          {state.dealer.cards.map((c, i) => (
            <PlayingCard key={i} card={c} hidden={state.dealer.hidden && i === 1} />
          ))}
        </div>
        {state.dealer.cards.length > 0 && (
          <div className="mt-1 text-sm font-semibold text-white/80">
            {dealerTotal}
            {state.dealer.hidden ? " +" : ""}
          </div>
        )}
      </div>

      {/* Places */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
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
                <p className="text-xs text-white/60">
                  Ta mise : <span className="text-gold">{formatChips(mySeat.baseBet)}</span>
                </p>
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
        className={`flex h-44 flex-col items-center justify-center rounded-xl border border-dashed text-sm ${
          canSit ? "border-gold/50 text-gold hover:bg-gold/10" : "border-white/10 text-white/30"
        }`}
      >
        {canSit ? "+ S'asseoir" : `Place ${index + 1}`}
      </button>
    );
  }

  return (
    <div
      className={`flex h-44 flex-col items-center justify-between rounded-xl border p-2 ${
        isTurnSeat ? "border-gold shadow-glow" : isMe ? "border-gold/40" : "border-white/15"
      } bg-black/30`}
    >
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
          <HandView key={hi} hand={h} active={isTurnSeat && turnHand === hi} />
        ))}
      </div>
    </div>
  );
}

function HandView({ hand, active }: { hand: BJHand; active: boolean }) {
  const total = handTotal(hand.cards).total;
  return (
    <div className={`flex flex-col items-center rounded-lg p-1 ${active ? "bg-gold/15 ring-1 ring-gold" : ""}`}>
      <div className="flex justify-center gap-0.5">
        {hand.cards.map((c, i) => (
          <div key={i} style={{ transform: "scale(0.55)", transformOrigin: "top", margin: "-3px -8px" }}>
            <PlayingCard card={c} />
          </div>
        ))}
      </div>
      <div className="text-center text-[11px]">
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
