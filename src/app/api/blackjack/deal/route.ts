import { NextRequest, NextResponse } from "next/server";
import { withBlackjack } from "@/lib/gameStore";
import { dealRound, payoutCredits, bjDeadline } from "@/lib/games/blackjack";
import type { Seat } from "@/lib/types";

export const dynamic = "force-dynamic";

// POST /api/blackjack/deal { code } -> distribue le tour
export async function POST(req: NextRequest) {
  try {
    const code = String((await req.json()).code ?? "").toUpperCase();
    if (!code) return NextResponse.json({ error: "code requis." }, { status: 400 });

    const res = await withBlackjack(code, (state, deck) => {
      if (state.phase !== "betting") return null;
      const hasBets = state.seats.some((s: Seat | null) => s && s.baseBet > 0);
      if (!hasBets) return null;
      const out = dealRound(state, deck);
      out.state.deadline = bjDeadline(out.state, Date.now());
      const credits =
        out.state.phase === "payout" ? payoutCredits(out.state) : undefined;
      return { state: out.state, deck: out.deck, credits };
    });

    if (!res.ok) {
      const msg =
        res.reason === "rejected"
          ? "Impossible de distribuer (aucune mise ou tour déjà lancé)."
          : res.reason;
      return NextResponse.json({ error: msg }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Erreur serveur" }, { status: 500 });
  }
}
