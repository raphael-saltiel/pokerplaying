import { NextRequest, NextResponse } from "next/server";
import { adjustBalance } from "@/lib/gameStore";
import { getTicket, drawOutcome, buildGrid } from "@/lib/games/scratch";

export const dynamic = "force-dynamic";

// POST /api/scratch/buy { playerId, ticketId }
// Le résultat est tiré ici (ticket "pré-imprimé"), puis la grille en découle.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { playerId, ticketId } = body;
    const ticket = getTicket(String(ticketId ?? ""));
    if (!playerId || !ticket) {
      return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
    }

    // Débit du prix (refusé si fonds insuffisants).
    const afterBuy = await adjustBalance(playerId, -ticket.price);
    if (afterBuy === null) {
      return NextResponse.json({ error: "Solde insuffisant." }, { status: 400 });
    }

    const prize = drawOutcome(ticket);
    const grid = buildGrid(ticket, prize);

    let balance = afterBuy;
    if (prize > 0) {
      const credited = await adjustBalance(playerId, prize);
      if (credited !== null) balance = credited;
    }

    return NextResponse.json({
      grid,
      prize,
      price: ticket.price,
      ticketId: ticket.id,
      balance,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Erreur serveur" }, { status: 500 });
  }
}
