import type { RouletteBet, RouletteState } from "@/lib/types";

// Durées (ms) des minuteurs.
export const ROULETTE_BET_MS = 25000; // décompte avant tirage auto
export const ROULETTE_RESULT_MS = 8000; // affichage du résultat avant nouveau tour

// Roulette européenne : un seul zéro (0-36).
export const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

export function colorOf(n: number): "red" | "black" | "green" {
  if (n === 0) return "green";
  return RED_NUMBERS.has(n) ? "red" : "black";
}

/**
 * Multiplicateur GAGNÉ (hors mise initiale) pour une mise gagnante.
 * Ex : plein = 35 (on récupère mise + 35×mise). Retourne 0 si perdante.
 */
export function betMultiplier(bet: RouletteBet, result: number): number {
  const isWin = betWins(bet, result);
  if (!isWin) return 0;
  switch (bet.kind) {
    case "number":
      return 35;
    case "dozen":
    case "column":
      return 2;
    default:
      return 1; // chances simples (rouge/noir/pair/impair/manque/passe)
  }
}

export function betWins(bet: RouletteBet, result: number): boolean {
  if (result === 0) {
    // Seul un pari "plein" sur 0 gagne.
    return bet.kind === "number" && bet.value === 0;
  }
  switch (bet.kind) {
    case "number":
      return bet.value === result;
    case "red":
      return colorOf(result) === "red";
    case "black":
      return colorOf(result) === "black";
    case "even":
      return result % 2 === 0;
    case "odd":
      return result % 2 === 1;
    case "low":
      return result >= 1 && result <= 18;
    case "high":
      return result >= 19 && result <= 36;
    case "dozen":
      // value 1 => 1-12, 2 => 13-24, 3 => 25-36
      return Math.ceil(result / 12) === bet.value;
    case "column":
      // value 1 => reste 1, value 2 => reste 2, value 3 => reste 0
      return result % 3 === (bet.value === 3 ? 0 : bet.value);
    default:
      return false;
  }
}

/** Tire un numéro aléatoire 0-36. */
export function spinWheel(): number {
  return Math.floor(Math.random() * 37);
}

/**
 * Résout le tour de roulette : tire un numéro, calcule l'état résultat et les
 * crédits (mise + gain) à reverser. Pur — utilisé par /spin et /advance.
 */
export function resolveRoulette(
  state: RouletteState,
  now: number
): { state: RouletteState; credits: Record<string, number>; result: number } {
  const result = spinWheel();
  const bets: RouletteBet[] = state.bets ?? [];

  const credits: Record<string, number> = {};
  const staked: Record<string, number> = {};
  const names: Record<string, string> = {};
  for (const b of bets) {
    names[b.playerId] = b.name;
    staked[b.playerId] = (staked[b.playerId] ?? 0) + b.amount;
    const mult = betMultiplier(b, result);
    if (mult > 0) credits[b.playerId] = (credits[b.playerId] ?? 0) + b.amount * (1 + mult);
  }

  const lastPayouts = Object.keys(staked).map((pid) => ({
    playerId: pid,
    name: names[pid],
    net: (credits[pid] ?? 0) - staked[pid],
  }));

  const history = [result, ...(state.history ?? [])].slice(0, 15);

  const newState: RouletteState = {
    ...state,
    phase: "result",
    bets: [],
    lastResult: result,
    history,
    spinId: (state.spinId ?? 0) + 1,
    deadline: now + ROULETTE_RESULT_MS,
    lastPayouts,
  };
  return { state: newState, credits, result };
}

export function betLabel(bet: RouletteBet): string {
  switch (bet.kind) {
    case "number":
      return `N°${bet.value}`;
    case "red":
      return "Rouge";
    case "black":
      return "Noir";
    case "even":
      return "Pair";
    case "odd":
      return "Impair";
    case "low":
      return "Manque (1-18)";
    case "high":
      return "Passe (19-36)";
    case "dozen":
      return `${bet.value}ère/e douzaine`;
    case "column":
      return `Colonne ${bet.value}`;
  }
}
