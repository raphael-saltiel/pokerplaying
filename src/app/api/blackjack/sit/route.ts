import { NextRequest, NextResponse } from "next/server";
import { withTable } from "@/lib/gameStore";
import type { Seat } from "@/lib/types";

export const dynamic = "force-dynamic";

// POST /api/blackjack/sit { code, playerId, name, seat }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const code = String(body.code ?? "").toUpperCase();
    const { playerId, name } = body;
    const seatIndex = Number(body.seat);
    if (!code || !playerId || !name || !Number.isInteger(seatIndex)) {
      return NextResponse.json({ error: "Champs requis." }, { status: 400 });
    }

    const res = await withTable(code, (t) => {
      const state = t.state;
      if (state.phase !== "betting") return null; // on ne s'assoit qu'en phase de mise
      if (seatIndex < 0 || seatIndex >= state.seats.length) return null;
      if (state.seats[seatIndex]) return null; // place déjà prise

      const seats = state.seats.map((s: Seat | null) =>
        s && s.playerId === playerId ? null : s // libère son ancienne place (sans mise)
      );
      // refus si le joueur avait déjà une mise engagée ailleurs
      const had = state.seats.find((s: Seat | null) => s?.playerId === playerId);
      if (had && had.bet > 0) return null;

      seats[seatIndex] = {
        playerId,
        name: String(name).slice(0, 20),
        bet: 0,
        cards: [],
        status: "waiting",
        doubled: false,
        result: null,
        payout: 0,
      } as Seat;
      return { state: { ...state, seats } };
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: res.reason === "rejected" ? "Place indisponible." : res.reason },
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Erreur serveur" }, { status: 500 });
  }
}
