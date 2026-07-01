import { NextRequest, NextResponse } from "next/server";
import { withBlackjack, adjustBalance, loadTable, getPlayer } from "@/lib/gameStore";
import {
  setInsurance,
  allInsuranceDecided,
  finishInsurance,
  payoutCredits,
  bjDeadline,
} from "@/lib/games/blackjack";
import type { BlackjackState, Seat } from "@/lib/types";

export const dynamic = "force-dynamic";

// POST /api/blackjack/insurance { code, playerId, amount }
// amount = 0 pour refuser l'assurance.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const code = String(body.code ?? "").toUpperCase();
    const { playerId } = body;
    const amount = Math.max(0, Math.floor(Number(body.amount ?? 0)));
    if (!code || !playerId) {
      return NextResponse.json({ error: "Champs requis." }, { status: 400 });
    }

    // Débit de l'assurance AVANT (remboursée si refusée par le moteur).
    let escrow = 0;
    if (amount > 0) {
      const table = await loadTable(code);
      if (!table) return NextResponse.json({ error: "Salon introuvable." }, { status: 404 });
      const state = table.state as BlackjackState;
      const seat = state.seats.find((s: Seat | null) => s?.playerId === playerId);
      if (
        state.phase !== "insurance" ||
        !seat ||
        seat.hands.length === 0 ||
        seat.insuranceDecided
      ) {
        return NextResponse.json({ error: "Assurance impossible maintenant." }, { status: 409 });
      }
      const max = Math.floor(seat.hands[0].bet / 2);
      escrow = Math.min(amount, max);
      const nb = await adjustBalance(playerId, -escrow);
      if (nb === null) {
        return NextResponse.json({ error: "Solde insuffisant." }, { status: 400 });
      }
    }

    const res = await withBlackjack(code, (state, deck) => {
      if (state.phase !== "insurance") return null;
      const idx = state.seats.findIndex((s: Seat | null) => s?.playerId === playerId);
      if (idx < 0) return null;
      const withIns = setInsurance(state, idx, escrow);
      if (!withIns) return null;
      // Si tout le monde a décidé, on résout la phase d'assurance.
      if (allInsuranceDecided(withIns)) {
        const out = finishInsurance(withIns, deck);
        out.state.deadline = bjDeadline(out.state, Date.now());
        const credits = out.state.phase === "payout" ? payoutCredits(out.state) : undefined;
        return { state: out.state, deck: out.deck, credits };
      }
      return { state: withIns, deck };
    });

    if (!res.ok) {
      if (escrow > 0) await adjustBalance(playerId, escrow);
      const player = await getPlayer(playerId);
      return NextResponse.json({ error: res.reason, balance: player?.balance }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Erreur serveur" }, { status: 500 });
  }
}
