import { NextRequest, NextResponse } from "next/server";
import { adjustBalance } from "@/lib/gameStore";

export const dynamic = "force-dynamic";

// Symboles et gains (multiplicateur de la mise pour un triple).
const SYMBOLS = ["🍒", "🍋", "🔔", "⭐", "7️⃣", "💎"] as const;
const TRIPLE: Record<string, number> = {
  "🍒": 5,
  "🍋": 8,
  "🔔": 12,
  "⭐": 20,
  "7️⃣": 40,
  "💎": 100,
};

function reel(): string {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

// POST /api/slots/spin { playerId, bet } -> { reels, payout, balance, win }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { playerId } = body;
    const bet = Math.floor(Number(body.bet));
    if (!playerId) return NextResponse.json({ error: "playerId requis." }, { status: 400 });
    if (!Number.isInteger(bet) || bet <= 0) {
      return NextResponse.json({ error: "Mise invalide." }, { status: 400 });
    }

    // Débit de la mise (refusé si fonds insuffisants).
    const afterBet = await adjustBalance(playerId, -bet);
    if (afterBet === null) {
      return NextResponse.json({ error: "Solde insuffisant." }, { status: 400 });
    }

    const reels = [reel(), reel(), reel()];
    let gross = 0;
    if (reels[0] === reels[1] && reels[1] === reels[2]) {
      gross = bet * TRIPLE[reels[0]];
    } else {
      // deux cerises = mise x2 ; une cerise = mise rendue
      const cherries = reels.filter((r) => r === "🍒").length;
      if (cherries === 2) gross = bet * 2;
      else if (cherries === 1) gross = bet;
    }

    let balance = afterBet;
    if (gross > 0) {
      const credited = await adjustBalance(playerId, gross);
      if (credited !== null) balance = credited;
    }

    return NextResponse.json({
      reels,
      payout: gross - bet, // net
      gross,
      balance,
      win: gross > 0,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Erreur serveur" }, { status: 500 });
  }
}
