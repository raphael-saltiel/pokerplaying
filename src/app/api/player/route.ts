import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getPlayer } from "@/lib/gameStore";
import { STARTING_BALANCE } from "@/lib/types";

export const dynamic = "force-dynamic";

// POST /api/player { name } -> crée un joueur (solde initial 10000)
export async function POST(req: NextRequest) {
  try {
    const { name } = await req.json();
    const clean = String(name ?? "").trim().slice(0, 20);
    if (!clean) {
      return NextResponse.json({ error: "Nom requis." }, { status: 400 });
    }
    const { data, error } = await supabaseAdmin
      .from("players")
      .insert({ name: clean, balance: STARTING_BALANCE })
      .select("id, name, balance")
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message ?? "Erreur serveur" },
      { status: 500 }
    );
  }
}

// GET /api/player?id=... -> récupère un joueur (solde à jour)
export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id requis." }, { status: 400 });
    const player = await getPlayer(id);
    if (!player) {
      return NextResponse.json({ error: "Joueur introuvable." }, { status: 404 });
    }
    return NextResponse.json(player);
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message ?? "Erreur serveur" },
      { status: 500 }
    );
  }
}
