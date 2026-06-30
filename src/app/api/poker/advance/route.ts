import { NextRequest, NextResponse } from "next/server";
import { withPoker } from "@/lib/gameStore";
import { startHand, applyAction } from "@/lib/games/poker";
import type { PokerSeat } from "@/lib/types";

export const dynamic = "force-dynamic";

// POST /api/poker/advance { code }
// Pilote des minuteurs : appelé par les clients quand l'échéance est atteinte.
// Idempotent grâce à la garde de version (un seul client "gagne").
export async function POST(req: NextRequest) {
  try {
    const code = String((await req.json()).code ?? "").toUpperCase();
    if (!code) return NextResponse.json({ error: "code requis." }, { status: 400 });

    const now = Date.now();
    const res = await withPoker(code, (state, secret) => {
      if (state.deadline == null || now < state.deadline) return null; // pas encore

      const eligible = state.seats.filter(
        (s: PokerSeat | null) => s && s.stack > 0
      ).length;

      if (state.phase === "waiting") {
        if (eligible >= 2) {
          const started = startHand(state, secret.deck, now);
          if (started) return started;
        }
        return { state: { ...state, deadline: null }, deck: secret.deck, hole: secret.hole };
      }

      if (state.phase === "playing") {
        if (state.toAct == null) return null;
        const out = applyAction(state, secret.deck, secret.hole, state.toAct, "timeout", 0, now);
        if (!out) return null;
        return { state: out.state, deck: out.deck, hole: secret.hole };
      }

      // showdown -> main suivante (ou attente)
      if (eligible >= 2) {
        const started = startHand(state, secret.deck, now);
        if (started) return started;
      }
      return {
        state: {
          ...state,
          phase: "waiting",
          toAct: null,
          deadline: null,
          message: "En attente de joueurs…",
        },
        deck: secret.deck,
        hole: secret.hole,
      };
    });

    if (!res.ok) {
      // "rejected" = rien à faire / déjà traité par un autre client : pas une erreur.
      return NextResponse.json({ ok: false, reason: res.reason });
    }
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Erreur serveur" }, { status: 500 });
  }
}
