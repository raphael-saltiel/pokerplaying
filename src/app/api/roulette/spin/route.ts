import { NextRequest, NextResponse } from "next/server";
import { withTable } from "@/lib/gameStore";
import { resolveRoulette } from "@/lib/games/roulette";

export const dynamic = "force-dynamic";

// POST /api/roulette/spin { code } -> tire le numéro et résout les mises
export async function POST(req: NextRequest) {
  try {
    const code = String((await req.json()).code ?? "").toUpperCase();
    if (!code) return NextResponse.json({ error: "code requis." }, { status: 400 });

    const now = Date.now();
    const res = await withTable<{ result: number }>(code, (t) => {
      if (t.state.phase !== "betting") return null;
      const { state, credits, result } = resolveRoulette(t.state, now);
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
