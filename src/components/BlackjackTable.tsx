"use client";

import { useState } from "react";
import { usePlayer } from "@/components/PlayerProvider";
import { PlayingCard } from "@/components/PlayingCard";
import { post } from "@/lib/client";
import { formatChips } from "@/lib/format";
import { handTotal } from "@/lib/games/cards";
import type { BlackjackState, Seat } from "@/lib/types";

const CHIPS = [50, 100, 250, 500];

export function BlackjackTable({ code, state: raw }: { code: string; state: BlackjackState }) {
  // Filet de sécurité contre un état partiel : les structures existent toujours.
  const state: BlackjackState = {
    ...raw,
    seats: raw.seats ?? [],
    dealer: raw.dealer ?? { cards: [], hidden: true },
  };
  const { player, setBalance } = usePlayer();
  const [chip, setChip] = useState(100);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const mySeatIndex = state.seats.findIndex((s) => s?.playerId === player?.id);
  const mySeat = mySeatIndex >= 0 ? state.seats[mySeatIndex] : null;
  const isMyTurn =
    state.phase === "playing" &&
    state.turnSeat != null &&
    state.seats[state.turnSeat]?.playerId === player?.id;
  const anyBet = state.seats.some((s) => s && s.bet > 0);

  async function call(url: string, body: any) {
    setBusy(true);
    setErr(null);
    const { ok, data } = await post(url, body);
    if (!ok) setErr(data.error ?? "Action refusée.");
    if (typeof data.balance === "number") setBalance(data.balance);
    setBusy(false);
  }

  const sit = (seat: number) =>
    call("/api/blackjack/sit", { code, playerId: player!.id, name: player!.name, seat });
  const bet = () => call("/api/blackjack/bet", { code, playerId: player!.id, amount: chip });
  const leave = () => call("/api/blackjack/leave", { code, playerId: player!.id });
  const deal = () => call("/api/blackjack/deal", { code });
  const act = (action: string) => call("/api/blackjack/action", { code, playerId: player!.id, action });
  const next = () => call("/api/blackjack/new", { code });

  const dealerTotal = state.dealer.hidden
    ? handTotal(state.dealer.cards.slice(0, 1)).total
    : handTotal(state.dealer.cards).total;

  return (
    <div className="card-surface p-4">
      {/* Message / phase */}
      <div className="mb-4 text-center">
        <span className="rounded-full bg-black/40 px-4 py-1 text-sm text-gold">
          {state.message}
        </span>
      </div>

      {/* Croupier */}
      <div className="mb-6 flex flex-col items-center">
        <div className="mb-1 text-xs uppercase tracking-wide text-white/50">Croupier</div>
        <div className="flex gap-1.5">
          {state.dealer.cards.length === 0 && (
            <div className="playing-card back opacity-30" />
          )}
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
            isTurn={state.phase === "playing" && state.turnSeat === i}
            canSit={state.phase === "betting" && !seat && mySeatIndex < 0}
            onSit={() => sit(i)}
            busy={busy}
          />
        ))}
      </div>

      {err && <p className="mb-3 text-center text-sm text-red-400">{err}</p>}

      {/* Contrôles */}
      <div className="border-t border-white/10 pt-4">
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
                  <button onClick={bet} disabled={busy} className="btn-gold">
                    + Miser {chip}
                  </button>
                  <button onClick={leave} disabled={busy} className="btn-ghost">
                    Quitter la place
                  </button>
                </div>
                <p className="text-xs text-white/60">
                  Ta mise : <span className="text-gold">{formatChips(mySeat.bet)}</span>
                </p>
              </>
            ) : (
              <p className="text-sm text-white/70">
                Clique sur une place libre pour t&apos;asseoir.
              </p>
            )}
            <button
              onClick={deal}
              disabled={busy || !anyBet}
              className="btn-gold mt-1 w-full max-w-xs"
            >
              🃏 Distribuer
            </button>
          </div>
        )}

        {state.phase === "playing" && (
          <div className="flex flex-col items-center gap-2">
            {isMyTurn ? (
              <div className="flex flex-wrap justify-center gap-2">
                <button onClick={() => act("hit")} disabled={busy} className="btn-gold">
                  Tirer
                </button>
                <button onClick={() => act("stand")} disabled={busy} className="btn-dark">
                  Rester
                </button>
                {mySeat?.cards.length === 2 && (
                  <button onClick={() => act("double")} disabled={busy} className="btn-ghost">
                    Doubler
                  </button>
                )}
              </div>
            ) : (
              <p className="text-sm text-white/60">
                {state.turnSeat != null
                  ? `Au tour de ${state.seats[state.turnSeat]?.name}…`
                  : "Le croupier joue…"}
              </p>
            )}
          </div>
        )}

        {state.phase === "payout" && (
          <div className="flex flex-col items-center gap-2">
            <button onClick={next} disabled={busy} className="btn-gold w-full max-w-xs">
              ↻ Nouveau tour
            </button>
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
  isTurn,
  canSit,
  onSit,
  busy,
}: {
  seat: Seat | null;
  index: number;
  isMe: boolean;
  isTurn: boolean;
  canSit: boolean;
  onSit: () => void;
  busy: boolean;
}) {
  if (!seat) {
    return (
      <button
        onClick={canSit ? onSit : undefined}
        disabled={!canSit || busy}
        className={`flex h-40 flex-col items-center justify-center rounded-xl border border-dashed text-sm ${
          canSit
            ? "border-gold/50 text-gold hover:bg-gold/10"
            : "border-white/10 text-white/30"
        }`}
      >
        {canSit ? "+ S'asseoir" : `Place ${index + 1}`}
      </button>
    );
  }

  const total = handTotal(seat.cards).total;
  return (
    <div
      className={`flex h-40 flex-col items-center justify-between rounded-xl border p-2 ${
        isTurn ? "border-gold shadow-glow" : isMe ? "border-gold/40" : "border-white/15"
      } bg-black/30`}
    >
      <div className="text-center">
        <div className={`text-sm font-semibold ${isMe ? "text-gold" : "text-white/90"}`}>
          {seat.name}
        </div>
        <div className="text-xs text-white/60">{formatChips(seat.bet)} jetons</div>
      </div>

      <div className="flex flex-wrap justify-center gap-0.5">
        {seat.cards.map((c, i) => (
          <PlayingCard key={i} card={c} />
        ))}
      </div>

      <div className="text-center text-xs">
        {seat.cards.length > 0 && <span className="font-bold text-white/80">{total}</span>}
        {seat.result && (
          <span className={`ml-1 ${resultColor(seat.result)}`}>
            {resultLabel(seat.result, seat.payout)}
          </span>
        )}
        {!seat.result && seat.status === "blackjack" && (
          <span className="ml-1 text-gold">Blackjack !</span>
        )}
        {!seat.result && seat.status === "bust" && (
          <span className="ml-1 text-red-400">Sauté</span>
        )}
      </div>
    </div>
  );
}

function resultColor(r: NonNullable<Seat["result"]>): string {
  if (r === "lose") return "text-red-400";
  if (r === "push") return "text-white/60";
  return "text-emerald-400";
}
function resultLabel(r: NonNullable<Seat["result"]>, payout: number): string {
  if (r === "blackjack") return `BJ +${formatChips(payout)}`;
  if (r === "win") return `+${formatChips(payout)}`;
  if (r === "push") return "Égalité";
  return `${formatChips(payout)}`;
}
