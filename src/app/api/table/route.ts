import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadTable } from "@/lib/gameStore";
import { initialState } from "@/lib/initialState";
import type { GameType } from "@/lib/types";

export const dynamic = "force-dynamic";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans I,O,0,1 ambigus

function randomCode(len = 4): string {
  let s = "";
  for (let i = 0; i < len; i++) {
    s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return s;
}

// POST /api/table { game, hostId } -> crée un salon, renvoie { code }
export async function POST(req: NextRequest) {
  try {
    const { game, hostId } = await req.json();
    if (game !== "roulette" && game !== "blackjack" && game !== "poker") {
      return NextResponse.json({ error: "Jeu inconnu." }, { status: 400 });
    }
    const state = initialState(game as GameType);

    // tentatives jusqu'à trouver un code libre
    for (let attempt = 0; attempt < 8; attempt++) {
      const code = randomCode();
      const { error } = await supabaseAdmin.from("tables").insert({
        code,
        game,
        state,
        host_id: hostId ?? null,
      });
      if (!error) {
        if (game === "blackjack" || game === "poker") {
          await supabaseAdmin
            .from("table_secrets")
            .upsert({ code, deck: [], hole: {} });
        }
        return NextResponse.json({ code, game });
      }
      // 23505 = violation d'unicité -> on réessaie avec un autre code
      if ((error as any).code !== "23505") {
        throw new Error(error.message);
      }
    }
    return NextResponse.json(
      { error: "Impossible de générer un code." },
      { status: 500 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message ?? "Erreur serveur" },
      { status: 500 }
    );
  }
}

// GET /api/table?code=... -> état courant
export async function GET(req: NextRequest) {
  try {
    const code = (req.nextUrl.searchParams.get("code") ?? "").toUpperCase();
    if (!code) return NextResponse.json({ error: "code requis." }, { status: 400 });
    const table = await loadTable(code);
    if (!table) {
      return NextResponse.json({ error: "Salon introuvable." }, { status: 404 });
    }
    return NextResponse.json(table);
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message ?? "Erreur serveur" },
      { status: 500 }
    );
  }
}
