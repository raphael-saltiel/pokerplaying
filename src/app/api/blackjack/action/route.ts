import { NextRequest, NextResponse } from "next/server";
import { withBlackjack, adjustBalance, loadTable, getPlayer } from "@/lib/gameStore";
import {
  hit,
  stand,
  double,
  split,
  surrender,
  payoutCredits,
  bjDeadline,
  legalMoves,
} from "@/lib/games/blackjack";
import type { BlackjackState, Seat } from "@/lib/types";

export const dynamic = "force-dynamic";

const ACTIONS = ["hit", "stand", "double", "split", "surrender"] as const;
type Action = (typeof ACTIONS)[number];

// POST /api/blackjack/action { code, playerId, action }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const code = String(body.code ?? "").toUpperCase();
    const { playerId } = body;
    const action = body.action as Action;
    if (!code || !playerId || !ACTIONS.includes(action)) {
      return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
    }

    // Double et Split nécessitent une mise supplémentaire : on débite AVANT,
    // on rembourse si l'action est rejetée.
    let escrow = 0;
    if (action === "double" || action === "split") {
      const table = await loadTable(code);
      if (!table) return NextResponse.json({ error: "Salon introuvable." }, { status: 404 });
      const state = table.state as BlackjackState;
      const seat: Seat | null = state.turnSeat != null ? state.seats[state.turnSeat] : null;
      const legal = state.turnSeat != null ? legalMoves(state, state.turnSeat) : null;
      if (
        state.phase !== "playing" ||
        !seat ||
        seat.playerId !== playerId ||
        !legal ||
        (action === "double" && !legal.canDouble) ||
        (action === "split" && !legal.canSplit)
      ) {
        return NextResponse.json({ error: "Action impossible maintenant." }, { status: 409 });
      }
      escrow = seat.hands[state.turnHand].bet;
      const nb = await adjustBalance(playerId, -escrow);
      if (nb === null) {
        return NextResponse.json({ error: "Solde insuffisant pour cette action." }, { status: 400 });
      }
    }

    const res = await withBlackjack(code, (state, deck) => {
      if (state.phase !== "playing" || state.turnSeat == null) return null;
      const seat: Seat | null = state.seats[state.turnSeat];
      if (!seat || seat.playerId !== playerId) return null;
      const legal = legalMoves(state, state.turnSeat);
      let out;
      if (action === "hit") out = hit(state, deck);
      else if (action === "stand") out = stand(state, deck);
      else if (action === "double") {
        if (!legal.canDouble) return null;
        out = double(state, deck);
      } else if (action === "split") {
        if (!legal.canSplit) return null;
        out = split(state, deck);
      } else {
        if (!legal.canSurrender) return null;
        out = surrender(state, deck);
      }
      out.state.deadline = bjDeadline(out.state, Date.now());
      const credits = out.state.phase === "payout" ? payoutCredits(out.state) : undefined;
      return { state: out.state, deck: out.deck, credits };
    });

    if (!res.ok) {
      if (escrow > 0) await adjustBalance(playerId, escrow); // remboursement
      const player = await getPlayer(playerId);
      const msg = res.reason === "rejected" ? "Ce n'est pas (ou plus) ton tour." : res.reason;
      return NextResponse.json({ error: msg, balance: player?.balance }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Erreur serveur" }, { status: 500 });
  }
}
