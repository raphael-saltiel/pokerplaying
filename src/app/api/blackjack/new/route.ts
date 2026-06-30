import { NextRequest, NextResponse } from "next/server";
import { withTable } from "@/lib/gameStore";
import { resetForNewRound } from "@/lib/games/blackjack";

export const dynamic = "force-dynamic";

// POST /api/blackjack/new { code } -> nouveau tour (garde les joueurs assis)
export async function POST(req: NextRequest) {
  try {
    const code = String((await req.json()).code ?? "").toUpperCase();
    if (!code) return NextResponse.json({ error: "code requis." }, { status: 400 });
    const res = await withTable(code, (t) => {
      if (t.state.phase !== "payout") return null;
      return { state: resetForNewRound(t.state) };
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: res.reason === "rejected" ? "Le tour n'est pas terminé." : res.reason },
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Erreur serveur" }, { status: 500 });
  }
}
