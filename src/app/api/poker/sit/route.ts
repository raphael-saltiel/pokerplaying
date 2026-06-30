import { NextRequest, NextResponse } from "next/server";
import { withTable, adjustBalance, getPlayer } from "@/lib/gameStore";
import { POKER_START_MS } from "@/lib/games/poker";
import type { PokerSeat } from "@/lib/types";

export const dynamic = "force-dynamic";

const MIN_BUYIN = 500;

// POST /api/poker/sit { code, playerId, name, seat, buyIn }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const code = String(body.code ?? "").toUpperCase();
    const { playerId, name } = body;
    const seatIndex = Number(body.seat);
    const buyIn = Math.floor(Number(body.buyIn));
    if (!code || !playerId || !name || !Number.isInteger(seatIndex)) {
      return NextResponse.json({ error: "Champs requis." }, { status: 400 });
    }
    if (!Number.isInteger(buyIn) || buyIn < MIN_BUYIN) {
      return NextResponse.json(
        { error: `Cave minimale : ${MIN_BUYIN} jetons.` },
        { status: 400 }
      );
    }

    // Débit de la cave depuis le solde global.
    const newBalance = await adjustBalance(playerId, -buyIn);
    if (newBalance === null) {
      return NextResponse.json({ error: "Solde insuffisant pour cette cave." }, { status: 400 });
    }

    const now = Date.now();
    const res = await withTable(code, (t) => {
      const state = t.state;
      if (seatIndex < 0 || seatIndex >= state.seats.length) return null;
      if (state.seats[seatIndex]) return null; // place prise
      if (state.seats.some((s: PokerSeat | null) => s?.playerId === playerId))
        return null; // déjà assis ailleurs

      const seats = state.seats.slice();
      seats[seatIndex] = {
        playerId,
        name: String(name).slice(0, 20),
        stack: buyIn,
        bet: 0,
        committed: 0,
        folded: state.phase === "playing",
        allIn: false,
        acted: false,
        hasCards: false,
        sittingOut: state.phase === "playing",
        cards: undefined,
      } as PokerSeat;

      const eligible = seats.filter((s: PokerSeat | null) => s && s.stack > 0).length;
      let deadline = state.deadline;
      let message = state.message;
      if (state.phase === "waiting" && eligible >= 2 && !deadline) {
        deadline = now + POKER_START_MS;
        message = "La partie commence dans quelques secondes…";
      }
      return { state: { ...state, seats, deadline, message } };
    });

    if (!res.ok) {
      await adjustBalance(playerId, buyIn); // remboursement
      const player = await getPlayer(playerId);
      const msg =
        res.reason === "rejected" ? "Place indisponible ou déjà assis." : res.reason;
      return NextResponse.json({ error: msg, balance: player?.balance }, { status: 409 });
    }
    return NextResponse.json({ ok: true, balance: newBalance });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Erreur serveur" }, { status: 500 });
  }
}
