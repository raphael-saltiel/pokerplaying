import { NextRequest, NextResponse } from "next/server";
import { withTable } from "@/lib/gameStore";
import { resolveRoulette } from "@/lib/games/roulette";

export const dynamic = "force-dynamic";

// POST /api/roulette/advance { code }
// Piloté par les clients quand l'échéance est atteinte. Idempotent (garde version).
export async function POST(req: NextRequest) {
  try {
    const code = String((await req.json()).code ?? "").toUpperCase();
    if (!code) return NextResponse.json({ error: "code requis." }, { status: 400 });

    const now = Date.now();
    const res = await withTable(code, (t) => {
      const s = t.state;
      if (s.deadline == null || now < s.deadline) return null; // pas encore

      if (s.phase === "betting") {
        if ((s.bets ?? []).length === 0) {
          return { state: { ...s, deadline: null } }; // aucune mise -> on annule le décompte
        }
        const { state, credits } = resolveRoulette(s, now);
        return { state, credits }; // tirage auto (atomique)
      }
      // phase "result" -> nouveau tour
      return {
        state: { ...s, phase: "betting", bets: [], lastPayouts: [], deadline: null },
      };
    });

    if (!res.ok) return NextResponse.json({ ok: false, reason: res.reason });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Erreur serveur" }, { status: 500 });
  }
}
