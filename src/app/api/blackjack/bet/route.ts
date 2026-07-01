import { NextRequest, NextResponse } from "next/server";
import { withTable, adjustBalance, getPlayer } from "@/lib/gameStore";
import { BJ_BET_MS } from "@/lib/games/blackjack";
import type { Seat } from "@/lib/types";

export const dynamic = "force-dynamic";

// POST /api/blackjack/bet { code, playerId, amount } -> ajoute des jetons à sa mise
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const code = String(body.code ?? "").toUpperCase();
    const { playerId } = body;
    const amount = Math.floor(Number(body.amount));
    if (!code || !playerId) {
      return NextResponse.json({ error: "Champs requis." }, { status: 400 });
    }
    if (!Number.isInteger(amount) || amount <= 0) {
      return NextResponse.json({ error: "Montant invalide." }, { status: 400 });
    }

    const newBalance = await adjustBalance(playerId, -amount);
    if (newBalance === null) {
      return NextResponse.json({ error: "Solde insuffisant." }, { status: 400 });
    }

    const res = await withTable(code, (t) => {
      const state = t.state;
      if (state.phase !== "betting") return null;
      const idx = state.seats.findIndex((s: Seat | null) => s?.playerId === playerId);
      if (idx < 0) return null; // pas assis
      const seats = state.seats.map((s: Seat | null, i: number) =>
        i === idx ? { ...s, baseBet: s!.baseBet + amount } : s
      );
      // Démarre le décompte avant distribution auto dès la première mise.
      const deadline = state.deadline ?? Date.now() + BJ_BET_MS;
      return { state: { ...state, seats, deadline } };
    });

    if (!res.ok) {
      await adjustBalance(playerId, amount); // remboursement
      const player = await getPlayer(playerId);
      const msg =
        res.reason === "rejected"
          ? "Assieds-toi à une place avant de miser (et seulement pendant les mises)."
          : res.reason;
      return NextResponse.json({ error: msg, balance: player?.balance }, { status: 409 });
    }
    return NextResponse.json({ ok: true, balance: newBalance });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Erreur serveur" }, { status: 500 });
  }
}
