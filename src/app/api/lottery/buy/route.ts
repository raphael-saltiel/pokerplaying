import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { adjustBalance } from "@/lib/gameStore";
import { LOTTO, drawDateOf, validPick } from "@/lib/games/lottery";

export const dynamic = "force-dynamic";

// POST /api/lottery/buy { playerId, name, numbers }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { playerId, name } = body;
    const numbers = Array.isArray(body.numbers)
      ? body.numbers.map((n: any) => Math.floor(Number(n)))
      : [];
    if (!playerId || !name) {
      return NextResponse.json({ error: "Champs requis." }, { status: 400 });
    }
    if (!validPick(numbers)) {
      return NextResponse.json(
        { error: `Choisis ${LOTTO.pick} numéros distincts entre 1 et ${LOTTO.max}.` },
        { status: 400 }
      );
    }

    const today = drawDateOf(new Date());

    const balance = await adjustBalance(playerId, -LOTTO.price);
    if (balance === null) {
      return NextResponse.json({ error: "Solde insuffisant." }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("lottery_tickets").insert({
      draw_date: today,
      player_id: playerId,
      name: String(name).slice(0, 20),
      numbers: [...numbers].sort((a, b) => a - b),
      prize: -1,
    });
    if (error) {
      await adjustBalance(playerId, LOTTO.price); // remboursement
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true, balance });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Erreur serveur" }, { status: 500 });
  }
}
