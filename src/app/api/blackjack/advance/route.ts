import { NextRequest, NextResponse } from "next/server";
import { withBlackjack } from "@/lib/gameStore";
import {
  dealRound,
  stand,
  setInsurance,
  finishInsurance,
  resetForNewRound,
  payoutCredits,
  bjDeadline,
} from "@/lib/games/blackjack";
import type { BlackjackState, Seat } from "@/lib/types";

export const dynamic = "force-dynamic";

// POST /api/blackjack/advance { code }
// Piloté par les clients quand l'échéance est atteinte. Idempotent (garde version).
export async function POST(req: NextRequest) {
  try {
    const code = String((await req.json()).code ?? "").toUpperCase();
    if (!code) return NextResponse.json({ error: "code requis." }, { status: 400 });

    const now = Date.now();
    const res = await withBlackjack(code, (state: BlackjackState, deck) => {
      if (state.deadline == null || now < state.deadline) return null; // pas encore

      if (state.phase === "betting") {
        const hasBets = state.seats.some((s: Seat | null) => s && s.baseBet > 0);
        if (!hasBets) return { state: { ...state, deadline: null }, deck };
        const out = dealRound(state, deck);
        out.state.deadline = bjDeadline(out.state, now);
        const credits = out.state.phase === "payout" ? payoutCredits(out.state) : undefined;
        return { state: out.state, deck: out.deck, credits };
      }

      if (state.phase === "insurance") {
        // Temps écoulé : les indécis refusent l'assurance, puis on résout.
        let s = state;
        state.seats.forEach((seat: Seat | null, i: number) => {
          if (seat && seat.hands.length > 0 && !seat.insuranceDecided) {
            s = setInsurance(s, i, 0) ?? s;
          }
        });
        const out = finishInsurance(s, deck);
        out.state.deadline = bjDeadline(out.state, now);
        const credits = out.state.phase === "payout" ? payoutCredits(out.state) : undefined;
        return { state: out.state, deck: out.deck, credits };
      }

      if (state.phase === "playing") {
        if (state.turnSeat == null) return null;
        // Temps écoulé -> le joueur reste automatiquement.
        const out = stand(state, deck);
        out.state.deadline = bjDeadline(out.state, now);
        const credits = out.state.phase === "payout" ? payoutCredits(out.state) : undefined;
        return { state: out.state, deck: out.deck, credits };
      }

      // payout -> nouveau tour
      return { state: resetForNewRound(state), deck };
    });

    if (!res.ok) return NextResponse.json({ ok: false, reason: res.reason });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Erreur serveur" }, { status: 500 });
  }
}
