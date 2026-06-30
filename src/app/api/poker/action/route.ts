import { NextRequest, NextResponse } from "next/server";
import { withPoker } from "@/lib/gameStore";
import { applyAction, type PokerAction } from "@/lib/games/poker";
import type { PokerSeat } from "@/lib/types";

export const dynamic = "force-dynamic";

const ACTIONS: PokerAction[] = ["fold", "check", "call", "raise"];

// POST /api/poker/action { code, playerId, action, amount? }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const code = String(body.code ?? "").toUpperCase();
    const { playerId, action } = body;
    const amount = Math.floor(Number(body.amount ?? 0));
    if (!code || !playerId || !ACTIONS.includes(action)) {
      return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
    }

    const now = Date.now();
    const res = await withPoker(code, (state, secret) => {
      if (state.phase !== "playing" || state.toAct == null) return null;
      const seat: PokerSeat | null = state.seats[state.toAct];
      if (!seat || seat.playerId !== playerId) return null; // pas son tour
      const out = applyAction(
        state,
        secret.deck,
        secret.hole,
        state.toAct,
        action,
        amount,
        now
      );
      if (!out) return null;
      return { state: out.state, deck: out.deck, hole: secret.hole };
    });

    if (!res.ok) {
      const msg = res.reason === "rejected" ? "Action impossible (pas ton tour ?)." : res.reason;
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Erreur serveur" }, { status: 500 });
  }
}
