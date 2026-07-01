import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { adjustBalance } from "@/lib/gameStore";
import {
  LOTTO,
  drawDateOf,
  msUntilNextDraw,
  generateNumbers,
  countMatches,
  prizeFor,
} from "@/lib/games/lottery";

export const dynamic = "force-dynamic";

// Récupère (ou génère une seule fois) les numéros gagnants d'un tirage.
async function ensureDraw(date: string): Promise<number[]> {
  const { data } = await supabaseAdmin
    .from("lottery_draws")
    .select("numbers")
    .eq("draw_date", date)
    .maybeSingle();
  if (data) return data.numbers as number[];

  const numbers = generateNumbers();
  const { error } = await supabaseAdmin.from("lottery_draws").insert({ draw_date: date, numbers });
  if (error) {
    // Conflit d'unicité : généré en parallèle, on relit.
    const { data: d2 } = await supabaseAdmin
      .from("lottery_draws")
      .select("numbers")
      .eq("draw_date", date)
      .maybeSingle();
    if (d2) return d2.numbers as number[];
    throw new Error(error.message);
  }
  return numbers;
}

// Résout un tirage passé : crédite chaque ticket gagnant, une seule fois.
async function resolveDraw(date: string) {
  const winning = await ensureDraw(date);
  const { data: tickets } = await supabaseAdmin
    .from("lottery_tickets")
    .select("id, player_id, numbers")
    .eq("draw_date", date)
    .eq("prize", -1);

  for (const t of tickets ?? []) {
    const prize = prizeFor(countMatches(t.numbers as number[], winning));
    // Garde : on ne crédite que si on passe bien prize de -1 à sa valeur.
    const { data: upd } = await supabaseAdmin
      .from("lottery_tickets")
      .update({ prize })
      .eq("id", t.id)
      .eq("prize", -1)
      .select("id");
    if (Array.isArray(upd) && upd.length === 1 && prize > 0) {
      await adjustBalance(t.player_id as string, prize);
    }
  }
}

// GET /api/lottery/status?playerId=...
export async function GET(req: NextRequest) {
  try {
    const playerId = req.nextUrl.searchParams.get("playerId") ?? "";
    const now = new Date();
    const today = drawDateOf(now);

    // Résout les tirages passés encore en attente.
    const { data: pending, error: ePending } = await supabaseAdmin
      .from("lottery_tickets")
      .select("draw_date")
      .lt("draw_date", today)
      .eq("prize", -1);
    if (ePending) throw new Error(ePending.message);
    const dates = [...new Set((pending ?? []).map((p) => p.draw_date as string))];
    for (const dt of dates) await resolveDraw(dt);

    // Mes tickets du jour (en attente du tirage).
    const { data: mine } = playerId
      ? await supabaseAdmin
          .from("lottery_tickets")
          .select("numbers")
          .eq("draw_date", today)
          .eq("player_id", playerId)
      : { data: [] as any[] };

    // Dernier tirage résolu.
    const { data: lastDraw } = await supabaseAdmin
      .from("lottery_draws")
      .select("draw_date, numbers")
      .lt("draw_date", today)
      .order("draw_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    let last = null;
    if (lastDraw) {
      const { data: myLast } = playerId
        ? await supabaseAdmin
            .from("lottery_tickets")
            .select("numbers, prize")
            .eq("draw_date", lastDraw.draw_date)
            .eq("player_id", playerId)
        : { data: [] as any[] };
      last = {
        date: lastDraw.draw_date,
        numbers: lastDraw.numbers,
        myTickets: (myLast ?? []).map((t) => ({
          numbers: t.numbers,
          prize: t.prize,
          matches: countMatches(t.numbers as number[], lastDraw.numbers as number[]),
        })),
      };
    }

    return NextResponse.json({
      today,
      nextDrawIn: msUntilNextDraw(now),
      price: LOTTO.price,
      pick: LOTTO.pick,
      max: LOTTO.max,
      prizes: LOTTO.prizes,
      myToday: (mine ?? []).map((t) => t.numbers),
      last,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Erreur serveur" }, { status: 500 });
  }
}
