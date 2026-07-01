"use client";

import { useEffect, useRef, useState } from "react";
import { usePlayer } from "@/components/PlayerProvider";
import { PlayingCard } from "@/components/PlayingCard";
import { post } from "@/lib/client";
import { formatChips } from "@/lib/format";
import { legalFor, POKER_TURN_MS } from "@/lib/games/poker";
import { fireConfetti } from "@/lib/confetti";
import type { Card, PokerSeat, PokerState } from "@/lib/types";

export function PokerTable({ code, state: raw }: { code: string; state: PokerState }) {
  const state: PokerState = {
    ...raw,
    seats: raw.seats ?? [],
    board: raw.board ?? [],
  };
  const { player, setBalance } = usePlayer();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [myCards, setMyCards] = useState<Card[] | null>(null);
  const [sitSeat, setSitSeat] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const firedRef = useRef<number | null>(null);

  const mySeatIndex = state.seats.findIndex((s) => s?.playerId === player?.id);
  const mySeat = mySeatIndex >= 0 ? state.seats[mySeatIndex] : null;
  const isMyTurn =
    state.phase === "playing" && state.toAct != null && state.seats[state.toAct]?.playerId === player?.id;

  // Récupère mes cartes privées à chaque nouvelle main.
  useEffect(() => {
    if (!player || !mySeat || !mySeat.hasCards) {
      setMyCards(null);
      return;
    }
    let active = true;
    // `no-store` + n° de main dans l'URL : évite que le navigateur serve en
    // cache les cartes de la main précédente.
    fetch(`/api/poker/me?code=${code}&playerId=${player.id}&h=${state.handNo}`, {
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active && d) setMyCards(d.cards);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player?.id, state.handNo, mySeat?.hasCards, code]);

  // Confettis quand je remporte une main (une fois par main).
  const confettiHandRef = useRef(-1);
  useEffect(() => {
    if (state.phase !== "showdown" || !player) return;
    if (confettiHandRef.current === state.handNo) return;
    confettiHandRef.current = state.handNo;
    if ((state.winners ?? []).some((w) => w.playerId === player.id)) fireConfetti();
  }, [state.phase, state.handNo, player, state.winners]);

  // Minuteur : déclenche l'avancement quand l'échéance est atteinte.
  useEffect(() => {
    if (state.deadline == null) {
      firedRef.current = null;
      return;
    }
    const id = setInterval(() => {
      setTick((t) => t + 1);
      if (Date.now() >= state.deadline! && firedRef.current !== state.deadline) {
        firedRef.current = state.deadline!;
        post("/api/poker/advance", { code });
      }
    }, 300);
    return () => clearInterval(id);
  }, [state.deadline, code]);

  const secondsLeft =
    state.deadline != null ? Math.max(0, Math.ceil((state.deadline - Date.now()) / 1000)) : null;

  async function call(url: string, body: any) {
    setBusy(true);
    setErr(null);
    const { ok, data } = await post(url, body);
    if (!ok) setErr(data.error ?? "Action refusée.");
    if (typeof data.balance === "number") setBalance(data.balance);
    setBusy(false);
  }

  return (
    <div className="card-surface p-4">
      {/* Bandeau infos */}
      <div className="mb-3 flex items-center justify-between text-sm">
        <span className="text-white/70">
          Blindes <span className="text-gold">{state.smallBlind}/{state.bigBlind}</span>
          {state.handNo > 0 && <span className="ml-2 text-white/40">Main #{state.handNo}</span>}
        </span>
        {secondsLeft != null && (
          <span className="stat rounded-full bg-black/40 px-3 py-1 text-neon-cyan">⏱ {secondsLeft}s</span>
        )}
      </div>

      {/* Barre de minuteur du joueur actif */}
      {state.phase === "playing" && state.deadline != null && (
        <div className="mb-3 h-1 w-full overflow-hidden rounded bg-white/5">
          <div
            className="timer-bar"
            style={{
              width: `${Math.max(0, Math.min(100, ((state.deadline - Date.now()) / POKER_TURN_MS) * 100))}%`,
            }}
          />
        </div>
      )}

      {/* Tapis : board + pot */}
      <div className="mb-4 rounded-2xl border border-gold/20 bg-felt-dark/60 p-5">
        <div className="mb-3 text-center text-sm text-white/70">{state.message}</div>
        <div className="mb-3 flex justify-center gap-1.5">
          {[0, 1, 2, 3, 4].map((i) => {
            const c = state.board[i];
            return c ? (
              <PlayingCard key={i} card={c} />
            ) : (
              <div key={i} className="playing-card opacity-15" />
            );
          })}
        </div>
        <div className="text-center">
          <span className="rounded-full bg-black/50 px-4 py-1 font-semibold text-gold">
            Pot : {formatChips(state.pot)}
          </span>
        </div>
      </div>

      {/* Gagnants */}
      {state.phase === "showdown" && state.winners && state.winners.length > 0 && (
        <div className="mb-4 text-center text-sm">
          {state.winners.map((w) => (
            <span key={w.playerId} className="mx-1 inline-block rounded-full bg-emerald-600/30 px-3 py-1 text-emerald-200">
              🏆 {w.name} +{formatChips(w.amount)} {w.hand ? `(${w.hand})` : ""}
            </span>
          ))}
        </div>
      )}

      {/* Sièges */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {state.seats.map((seat, i) => (
          <PokerSeatView
            key={i}
            seat={seat}
            index={i}
            isButton={state.button === i && state.phase !== "waiting"}
            isTurn={state.phase === "playing" && state.toAct === i}
            isMe={seat?.playerId === player?.id}
            myCards={seat?.playerId === player?.id ? myCards : null}
            canSit={!seat && mySeatIndex < 0}
            onSit={() => setSitSeat(i)}
            busy={busy}
            phase={state.phase}
          />
        ))}
      </div>

      {err && <p className="mb-3 text-center text-sm text-red-400">{err}</p>}

      {/* Contrôles */}
      <div className="border-t border-white/10 pt-4">
        {!mySeat ? (
          <SitPanel
            code={code}
            seatTarget={sitSeat}
            onCancel={() => setSitSeat(null)}
            onSat={(b) => {
              setBalance(b);
              setSitSeat(null);
            }}
          />
        ) : isMyTurn ? (
          <ActionBar state={state} seatIndex={mySeatIndex} busy={busy} onAct={(a, amt) => call("/api/poker/action", { code, playerId: player!.id, action: a, amount: amt })} />
        ) : (
          <div className="flex items-center justify-between text-sm text-white/60">
            <span>
              {state.phase === "playing"
                ? `En attente de ${state.toAct != null ? state.seats[state.toAct]?.name : "…"}`
                : state.phase === "showdown"
                ? "Main terminée."
                : "En attente de joueurs…"}
            </span>
            <button onClick={() => call("/api/poker/leave", { code, playerId: player!.id })} disabled={busy} className="btn-ghost text-xs">
              Quitter la table
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// (séparé pour garder le composant principal lisible)
function ActionBar({
  state,
  seatIndex,
  busy,
  onAct,
}: {
  state: PokerState;
  seatIndex: number;
  busy: boolean;
  onAct: (action: string, amount: number) => void;
}) {
  const L = legalFor(state, seatIndex);
  const [raiseTo, setRaiseTo] = useState(L.minRaiseTo);

  useEffect(() => {
    setRaiseTo(L.minRaiseTo);
  }, [L.minRaiseTo, state.handNo, state.street]);

  const canRaise = L.maxRaiseTo > state.currentBet;
  const clamp = (v: number) => Math.max(L.minRaiseTo, Math.min(L.maxRaiseTo, v));
  const halfPot = clamp(state.currentBet + Math.floor(state.pot / 2));
  const fullPot = clamp(state.currentBet + state.pot);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap justify-center gap-2">
        <button onClick={() => onAct("fold", 0)} disabled={busy} className="btn-dark">
          Se coucher
        </button>
        {L.canCheck ? (
          <button onClick={() => onAct("check", 0)} disabled={busy} className="btn-gold">
            Check
          </button>
        ) : (
          <button onClick={() => onAct("call", 0)} disabled={busy} className="btn-gold">
            Suivre {formatChips(L.callAmount)}
          </button>
        )}
        {canRaise && (
          <button onClick={() => onAct("raise", raiseTo)} disabled={busy} className="btn-ghost">
            {state.currentBet > 0 ? "Relancer à" : "Miser"} {formatChips(raiseTo)}
          </button>
        )}
      </div>

      {canRaise && (
        <>
          {/* Mises rapides */}
          <div className="flex flex-wrap justify-center gap-2 text-xs">
            <button onClick={() => setRaiseTo(halfPot)} className="btn-dark px-3 py-1">
              ½ Pot
            </button>
            <button onClick={() => setRaiseTo(fullPot)} className="btn-dark px-3 py-1">
              Pot
            </button>
            <button onClick={() => setRaiseTo(L.maxRaiseTo)} className="btn-ghost px-3 py-1">
              Tapis
            </button>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={L.minRaiseTo}
              max={L.maxRaiseTo}
              step={state.bigBlind}
              value={raiseTo}
              onChange={(e) => setRaiseTo(Number(e.target.value))}
              className="flex-1 accent-neon-cyan"
            />
            <span className="stat w-20 text-right text-sm text-neon-cyan">{formatChips(raiseTo)}</span>
          </div>
        </>
      )}
    </div>
  );
}

function SitPanel({
  code,
  seatTarget,
  onCancel,
  onSat,
}: {
  code: string;
  seatTarget: number | null;
  onCancel: () => void;
  onSat: (balance: number) => void;
}) {
  const { player } = usePlayer();
  const [buyIn, setBuyIn] = useState(2000);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (seatTarget == null) {
    return (
      <p className="text-center text-sm text-white/70">
        Clique sur une place libre pour t&apos;asseoir.
      </p>
    );
  }

  async function sit() {
    if (!player) return;
    setBusy(true);
    setErr(null);
    const { ok, data } = await post("/api/poker/sit", {
      code,
      playerId: player.id,
      name: player.name,
      seat: seatTarget,
      buyIn,
    });
    setBusy(false);
    if (!ok) {
      setErr(data.error ?? "Impossible de s'asseoir.");
      return;
    }
    onSat(data.balance);
  }

  const max = Math.min(player?.balance ?? 0, 10000);
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="text-sm text-white/80">
        Place {seatTarget + 1} · Cave : <span className="text-gold">{formatChips(buyIn)}</span>
      </div>
      <input
        type="range"
        min={500}
        max={Math.max(500, max)}
        step={100}
        value={Math.min(buyIn, Math.max(500, max))}
        onChange={(e) => setBuyIn(Number(e.target.value))}
        className="w-full max-w-xs accent-gold"
      />
      {err && <p className="text-sm text-red-400">{err}</p>}
      <div className="flex gap-2">
        <button onClick={sit} disabled={busy || max < 500} className="btn-gold">
          S&apos;asseoir
        </button>
        <button onClick={onCancel} className="btn-ghost">
          Annuler
        </button>
      </div>
      {max < 500 && <p className="text-xs text-red-400">Solde insuffisant (cave min. 500).</p>}
    </div>
  );
}

function PokerSeatView({
  seat,
  index,
  isButton,
  isTurn,
  isMe,
  myCards,
  canSit,
  onSit,
  busy,
  phase,
}: {
  seat: PokerSeat | null;
  index: number;
  isButton: boolean;
  isTurn: boolean;
  isMe: boolean;
  myCards: Card[] | null;
  canSit: boolean;
  onSit: () => void;
  busy: boolean;
  phase: PokerState["phase"];
}) {
  if (!seat) {
    return (
      <button
        onClick={canSit ? onSit : undefined}
        disabled={!canSit || busy}
        className={`flex h-28 flex-col items-center justify-center rounded-xl border border-dashed text-sm ${
          canSit ? "border-gold/50 text-gold hover:bg-gold/10" : "border-white/10 text-white/30"
        }`}
      >
        {canSit ? "+ S'asseoir" : `Place ${index + 1}`}
      </button>
    );
  }

  // Cartes à afficher : les miennes (face visible), celles révélées à l'abattage,
  // sinon des dos si le joueur est encore dans la main.
  const shown: (Card | undefined)[] = isMe && myCards ? myCards : seat.cards ?? [];
  const showBacks = !isMe && !seat.cards && seat.hasCards && !seat.folded;

  return (
    <div
      className={`relative flex h-28 flex-col items-center justify-between rounded-xl border p-2 ${
        isTurn ? "turn-active border-neon-cyan" : isMe ? "border-neon-cyan/40" : "border-white/15"
      } ${seat.folded ? "opacity-50" : ""} bg-black/30`}
    >
      {isButton && (
        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-black">
          D
        </span>
      )}
      <div className="text-center">
        <div className={`text-sm font-semibold ${isMe ? "text-gold" : "text-white/90"}`}>
          {seat.name} {seat.allIn && <span className="text-red-300">(tapis)</span>}
        </div>
        <div className="text-xs text-white/60">{formatChips(seat.stack)} jetons</div>
      </div>

      <div className="flex gap-0.5">
        {showBacks && (
          <>
            <div className="playing-card back" style={{ width: 30, height: 44 }} />
            <div className="playing-card back" style={{ width: 30, height: 44 }} />
          </>
        )}
        {!showBacks &&
          shown.map((c, i) => (
            <div key={i} style={{ transform: "scale(0.6)", transformOrigin: "top", margin: "-2px -6px" }}>
              <PlayingCard card={c} />
            </div>
          ))}
      </div>

      <div className="h-4 text-center text-[11px] text-white/70">
        {seat.bet > 0 && <span className="text-gold">mise {formatChips(seat.bet)}</span>}
        {seat.bet === 0 && seat.lastAction && <span>{seat.lastAction}</span>}
      </div>
    </div>
  );
}
