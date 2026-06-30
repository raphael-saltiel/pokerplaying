import { NextRequest, NextResponse } from "next/server";
import { withBlackjack, adjustBalance, loadTable, getPlayer } from "@/lib/gameStore";
import { hit, stand, double, payoutCredits } from "@/lib/games/blackjack";
import type { Seat } from "@/lib/types";

export const dynamic = "force-dynamic";

// POST /api/blackjack/action { code, playerId, action: 'hit'|'stand'|'double' }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const code = String(body.code ?? "").toUpperCase();
    const { playerId, action } = body;
    if (!code || !playerId || !["hit", "stand", "double"].includes(action)) {
      return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
    }

    // Pour doubler : on débite la mise supplémentaire AVANT, on rembourse si rejet.
    let escrow = 0;
    if (action === "double") {
      const table = await loadTable(code);
      if (!table) return NextResponse.json({ error: "Salon introuvable." }, { status: 404 });
      const state = table.state;
      const seat: Seat | null =
        state.turnSeat != null ? state.seats[state.turnSeat] : null;
      if (
        state.phase !== "playing" ||
        !seat ||
        seat.playerId !== playerId ||
        seat.cards.length !== 2
      ) {
        return NextResponse.json(
          { error: "Doubler impossible maintenant." },
          { status: 409 }
        );
      }
      escrow = seat.bet;
      const nb = await adjustBalance(playerId, -escrow);
      if (nb === null) {
        return NextResponse.json({ error: "Solde insuffisant pour doubler." }, { status: 400 });
      }
    }

    const res = await withBlackjack(code, (state, deck) => {
      if (state.phase !== "playing" || state.turnSeat == null) return null;
      const idx = state.turnSeat;
      const seat: Seat | null = state.seats[idx];
      if (!seat || seat.playerId !== playerId) return null;

      let out;
      if (action === "hit") out = hit(state, deck, idx);
      else if (action === "stand") out = stand(state, deck, idx);
      else {
        if (seat.cards.length !== 2) return null;
        out = double(state, deck, idx);
      }
      const credits =
        out.state.phase === "payout" ? payoutCredits(out.state) : undefined;
      return { state: out.state, deck: out.deck, credits };
    });

    if (!res.ok) {
      if (escrow > 0) await adjustBalance(playerId, escrow); // remboursement double
      const player = await getPlayer(playerId);
      const msg =
        res.reason === "rejected" ? "Ce n'est pas (ou plus) ton tour." : res.reason;
      return NextResponse.json({ error: msg, balance: player?.balance }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Erreur serveur" }, { status: 500 });
  }
}
