import { NextRequest, NextResponse } from "next/server";
import { withTable, adjustBalance } from "@/lib/gameStore";
import type { Seat } from "@/lib/types";

export const dynamic = "force-dynamic";

// POST /api/blackjack/leave { code, playerId } -> quitte sa place (remb. mise en cours)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const code = String(body.code ?? "").toUpperCase();
    const { playerId } = body;
    if (!code || !playerId) {
      return NextResponse.json({ error: "Champs requis." }, { status: 400 });
    }

    let refund = 0;
    const res = await withTable(code, (t) => {
      const state = t.state;
      if (state.phase !== "betting") return null; // on ne peut quitter qu'avant la donne
      const seat = state.seats.find((s: Seat | null) => s?.playerId === playerId);
      refund = seat?.bet ?? 0;
      const seats = state.seats.map((s: Seat | null) =>
        s?.playerId === playerId ? null : s
      );
      return { state: { ...state, seats } };
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: res.reason === "rejected" ? "Impossible de quitter en pleine partie." : res.reason },
        { status: 409 }
      );
    }
    if (refund > 0) await adjustBalance(playerId, refund);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Erreur serveur" }, { status: 500 });
  }
}
