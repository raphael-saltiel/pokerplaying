import { NextRequest, NextResponse } from "next/server";
import { loadPokerSecret } from "@/lib/gameStore";

export const dynamic = "force-dynamic";

// GET /api/poker/me?code=...&playerId=... -> renvoie MES cartes privées.
// Le playerId est un UUID connu de son seul porteur : les autres ne peuvent
// pas deviner les cartes d'autrui via cet endpoint.
export async function GET(req: NextRequest) {
  try {
    const code = (req.nextUrl.searchParams.get("code") ?? "").toUpperCase();
    const playerId = req.nextUrl.searchParams.get("playerId") ?? "";
    if (!code || !playerId) {
      return NextResponse.json({ error: "Paramètres requis." }, { status: 400 });
    }
    const secret = await loadPokerSecret(code);
    return NextResponse.json(
      { cards: secret.hole[playerId] ?? null },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Erreur serveur" }, { status: 500 });
  }
}
