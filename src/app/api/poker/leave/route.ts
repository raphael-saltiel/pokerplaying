import { NextRequest, NextResponse } from "next/server";
import { withPoker, adjustBalance } from "@/lib/gameStore";
import { forceFold } from "@/lib/games/poker";
import type { PokerSeat } from "@/lib/types";

export const dynamic = "force-dynamic";

// POST /api/poker/leave { code, playerId } -> quitte la table, encaisse le stack
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const code = String(body.code ?? "").toUpperCase();
    const { playerId } = body;
    if (!code || !playerId) {
      return NextResponse.json({ error: "Champs requis." }, { status: 400 });
    }

    const now = Date.now();
    let refund = 0;
    const res = await withPoker(code, (state, secret) => {
      const idx = state.seats.findIndex((s: PokerSeat | null) => s?.playerId === playerId);
      if (idx < 0) return null;
      const seat: PokerSeat = state.seats[idx];

      const inLiveHand =
        state.phase === "playing" && seat.hasCards && !seat.folded;

      if (inLiveHand) {
        // On le couche proprement (gère le tour / dernier en lice), on encaisse
        // son stack restant ; ses jetons déjà engagés restent dans le pot.
        const out = forceFold(state, secret.deck, secret.hole, idx, now);
        const s2 = out.state.seats[idx]!;
        refund = s2.stack;
        s2.stack = 0; // sera retiré au début de la main suivante
        s2.sittingOut = true;
        return { state: out.state, deck: out.deck, hole: secret.hole };
      }

      // Hors main : on rembourse le stack et on libère la place.
      refund = seat.stack;
      const seats = state.seats.slice();
      seats[idx] = null;
      let deadline = state.deadline;
      const eligible = seats.filter((s: PokerSeat | null) => s && s.stack > 0).length;
      if (eligible < 2 && state.phase === "waiting") deadline = null;
      return {
        state: { ...state, seats, deadline },
        deck: secret.deck,
        hole: secret.hole,
      };
    });

    if (!res.ok) {
      return NextResponse.json({ error: res.reason }, { status: 409 });
    }
    let balance: number | null = null;
    if (refund > 0) balance = await adjustBalance(playerId, refund);
    return NextResponse.json({ ok: true, balance: balance ?? undefined });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Erreur serveur" }, { status: 500 });
  }
}
