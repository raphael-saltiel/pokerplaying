import { NextRequest, NextResponse } from "next/server";
import { withTable, adjustBalance, getPlayer } from "@/lib/gameStore";
import { ROULETTE_BET_MS, isValidSplit, isValidCorner } from "@/lib/games/roulette";
import type { RouletteBetKind } from "@/lib/types";

export const dynamic = "force-dynamic";

const KINDS: RouletteBetKind[] = [
  "number",
  "split",
  "corner",
  "red",
  "black",
  "even",
  "odd",
  "low",
  "high",
  "dozen",
  "column",
];

function validValue(kind: RouletteBetKind, value: any): boolean {
  if (kind === "number") return Number.isInteger(value) && value >= 0 && value <= 36;
  if (kind === "dozen" || kind === "column")
    return value === 1 || value === 2 || value === 3;
  return true; // chances simples : pas de valeur
}

// POST /api/roulette/bet { code, playerId, name, kind, value?, numbers?, amount }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const code = String(body.code ?? "").toUpperCase();
    const { playerId, name, kind } = body;
    const value = body.value;
    const numbers: number[] = Array.isArray(body.numbers)
      ? body.numbers.map((n: any) => Math.floor(Number(n)))
      : [];
    const amount = Math.floor(Number(body.amount));

    if (!code || !playerId || !name) {
      return NextResponse.json({ error: "Champs requis." }, { status: 400 });
    }
    if (!KINDS.includes(kind)) {
      return NextResponse.json({ error: "Type de mise invalide." }, { status: 400 });
    }
    // Validation stricte (anti-triche) des cheval/carré, sinon valeur simple.
    if (kind === "split") {
      if (!isValidSplit(numbers)) {
        return NextResponse.json({ error: "Cheval invalide." }, { status: 400 });
      }
    } else if (kind === "corner") {
      if (!isValidCorner(numbers)) {
        return NextResponse.json({ error: "Carré invalide." }, { status: 400 });
      }
    } else if (!validValue(kind, value)) {
      return NextResponse.json({ error: "Valeur de mise invalide." }, { status: 400 });
    }
    if (!Number.isInteger(amount) || amount <= 0) {
      return NextResponse.json({ error: "Montant invalide." }, { status: 400 });
    }

    // 1) Débit atomique du solde (refusé si fonds insuffisants).
    const newBalance = await adjustBalance(playerId, -amount);
    if (newBalance === null) {
      return NextResponse.json({ error: "Solde insuffisant." }, { status: 400 });
    }

    // 2) Ajout de la mise à l'état (uniquement en phase de mise).
    const res = await withTable(code, (t) => {
      if (t.state.phase !== "betting") return null; // tour clos -> rejet
      const bet = {
        id: crypto.randomUUID(),
        playerId,
        name: String(name).slice(0, 20),
        kind,
        ...(kind === "split" || kind === "corner"
          ? { numbers }
          : value !== undefined
          ? { value }
          : {}),
        amount,
      };
      const players = (t.state.players ?? []).some((p: any) => p.id === playerId)
        ? t.state.players
        : [...(t.state.players ?? []), { id: playerId, name: String(name).slice(0, 20) }];
      // Démarre le décompte avant tirage auto dès la première mise du tour.
      const deadline = t.state.deadline ?? Date.now() + ROULETTE_BET_MS;
      return { state: { ...t.state, players, bets: [...t.state.bets, bet], deadline } };
    });

    if (!res.ok) {
      // 3) Échec -> remboursement.
      await adjustBalance(playerId, amount);
      const player = await getPlayer(playerId);
      const msg =
        res.reason === "rejected"
          ? "Les mises sont closes pour ce tour."
          : res.reason ?? "Mise refusée.";
      return NextResponse.json(
        { error: msg, balance: player?.balance },
        { status: 409 }
      );
    }

    return NextResponse.json({ ok: true, balance: newBalance });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message ?? "Erreur serveur" },
      { status: 500 }
    );
  }
}
