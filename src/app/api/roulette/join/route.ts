import { NextRequest, NextResponse } from "next/server";
import { withTable } from "@/lib/gameStore";

export const dynamic = "force-dynamic";

// POST /api/roulette/join { code, playerId, name } -> enregistre la présence
export async function POST(req: NextRequest) {
  try {
    const { code, playerId, name } = await req.json();
    if (!code || !playerId || !name) {
      return NextResponse.json({ error: "Champs requis." }, { status: 400 });
    }
    const res = await withTable(String(code).toUpperCase(), (t) => {
      const state = t.state;
      const players = (state.players ?? []).filter(
        (p: any) => p.id !== playerId
      );
      players.push({ id: playerId, name: String(name).slice(0, 20) });
      return { state: { ...state, players } };
    });
    if (!res.ok) {
      return NextResponse.json({ error: res.reason }, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message ?? "Erreur serveur" },
      { status: 500 }
    );
  }
}
