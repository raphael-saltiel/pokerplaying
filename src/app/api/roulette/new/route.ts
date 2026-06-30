import { NextRequest, NextResponse } from "next/server";
import { withTable } from "@/lib/gameStore";

export const dynamic = "force-dynamic";

// POST /api/roulette/new { code } -> ouvre un nouveau tour de mises
export async function POST(req: NextRequest) {
  try {
    const code = String((await req.json()).code ?? "").toUpperCase();
    if (!code) return NextResponse.json({ error: "code requis." }, { status: 400 });

    const res = await withTable(code, (t) => {
      if (t.state.phase !== "result") return null;
      return {
        state: {
          ...t.state,
          phase: "betting",
          bets: [],
          lastPayouts: [],
        },
      };
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
