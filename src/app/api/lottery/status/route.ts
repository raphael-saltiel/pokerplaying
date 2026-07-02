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
// Idempotent et sûr face aux appels concurrents : l'insertion utilise
// ON CONFLICT DO NOTHING, puis on relit la ligne qui a "gagné" la course.
async function ensureDraw(date: string): Promise<number[]> {
  const read = async (): Promise<number[] | null> => {
    const { data, error } = await supabaseAdmin
      .from("lottery_draws")
      .select("numbers")
      .eq("draw_date", date)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data?.numbers as number[]) ?? null;
  };

  const existing = await read();
  if (existing) return existing;

  const numbers = generateNumbers();
  const { error } = await supabaseAdmin
    .from("lottery_draws")
    .upsert({ draw_date: date, numbers }, { onConflict: "draw_date", ignoreDuplicates: true });
  if (error) throw new Error(error.message);

  // Relecture systématique : renvoie les numéros réellement stockés,
  // qu'ils viennent de nous ou d'une requête concurrente.
  const stored = await read();
  if (!stored) throw new Error("Tirage introuvable après création.");
  return stored;
}

// Résout un tirage passé : crédite chaque ticket gagnant, une seule fois.
async function resolveDraw(date: string) {
  const winning = await ensureDraw(date);
  const { data: tickets, error: eTickets } = await supabaseAdmin
    .from("lottery_tickets")
    .select("id, player_id, numbers")
    .eq("draw_date", date)
    .eq("prize", -1);
  if (eTickets) throw new Error(eTickets.message);

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

    // Résout les tirages passés encore en attente. Une résolution qui échoue
    // (course concurrente, hoquet réseau) ne doit pas bloquer l'affichage :
    // les tickets restent en attente et seront résolus à l'appel suivant.
    const { data: pending, error: ePending } = await supabaseAdmin
      .from("lottery_tickets")
      .select("draw_date")
      .lt("draw_date", today)
      .eq("prize", -1);
    if (ePending) throw new Error(ePending.message);
    const dates = [...new Set((pending ?? []).map((p) => p.draw_date as string))];
    for (const dt of dates) {
      try {
        await resolveDraw(dt);
      } catch (e) {
        console.error(`[lottery] résolution ${dt} échouée:`, e);
      }
    }

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
