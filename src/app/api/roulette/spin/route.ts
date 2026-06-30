import { NextRequest, NextResponse } from "next/server";
import { withTable } from "@/lib/gameStore";
import { betMultiplier, spinWheel } from "@/lib/games/roulette";
import type { RouletteBet } from "@/lib/types";

export const dynamic = "force-dynamic";

// POST /api/roulette/spin { code } -> tire le numéro et résout les mises
export async function POST(req: NextRequest) {
  try {
    const code = String((await req.json()).code ?? "").toUpperCase();
    if (!code) return NextResponse.json({ error: "code requis." }, { status: 400 });

    const res = await withTable<{ result: number }>(code, (t) => {
      if (t.state.phase !== "betting") return null;

      const result = spinWheel();
      const bets: RouletteBet[] = t.state.bets ?? [];

      // crédit brut (mise + gain) à reverser par joueur, et net pour l'affichage
      const credits: Record<string, number> = {};
      const staked: Record<string, number> = {};
      const names: Record<string, string> = {};
      for (const b of bets) {
        names[b.playerId] = b.name;
        staked[b.playerId] = (staked[b.playerId] ?? 0) + b.amount;
        const mult = betMultiplier(b, result);
        if (mult > 0) {
          credits[b.playerId] =
            (credits[b.playerId] ?? 0) + b.amount * (1 + mult);
        }
      }

      const lastPayouts = Object.keys(staked).map((pid) => ({
        playerId: pid,
        name: names[pid],
        net: (credits[pid] ?? 0) - staked[pid],
      }));

      const history = [result, ...(t.state.history ?? [])].slice(0, 15);

      const state = {
        ...t.state,
        phase: "result",
        bets: [],
        lastResult: result,
        history,
        spinId: (t.state.spinId ?? 0) + 1,
        lastPayouts,
      };
      // credits transmis à withTable => état + soldes validés atomiquement.
      return { state, result: { result }, credits };
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: res.reason === "rejected" ? "Tirage déjà effectué." : res.reason },
        { status: 409 }
      );
    }

    return NextResponse.json({ ok: true, result: res.result!.result });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message ?? "Erreur serveur" },
      { status: 500 }
    );
  }
}
