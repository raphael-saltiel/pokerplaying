// ============================================================
//  Loterie quotidienne (façon Loto)
//  Le joueur choisit 5 numéros parmi 1..40. Un tirage par jour (UTC).
//  Gains selon le nombre de bons numéros.
// ============================================================

export const LOTTO = {
  pick: 5,
  max: 40,
  price: 200,
  // gains par nombre de numéros trouvés
  prizes: { 5: 1000000, 4: 100000, 3: 3000, 2: 300 } as Record<number, number>,
};

/** Date de tirage 'YYYY-MM-DD' en UTC. */
export function drawDateOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Millisecondes jusqu'au prochain tirage (minuit UTC). */
export function msUntilNextDraw(now: Date): number {
  const next = new Date(now);
  next.setUTCHours(24, 0, 0, 0);
  return next.getTime() - now.getTime();
}

/** Tire `pick` numéros distincts dans 1..max. */
export function generateNumbers(): number[] {
  const set = new Set<number>();
  while (set.size < LOTTO.pick) set.add(1 + Math.floor(Math.random() * LOTTO.max));
  return [...set].sort((a, b) => a - b);
}

export function countMatches(ticket: number[], winning: number[]): number {
  const w = new Set(winning);
  return ticket.filter((n) => w.has(n)).length;
}

export function prizeFor(matches: number): number {
  return LOTTO.prizes[matches] ?? 0;
}

/** Grille valide : `pick` numéros distincts dans 1..max. */
export function validPick(nums: any): nums is number[] {
  return (
    Array.isArray(nums) &&
    nums.length === LOTTO.pick &&
    new Set(nums).size === LOTTO.pick &&
    nums.every((n) => Number.isInteger(n) && n >= 1 && n <= LOTTO.max)
  );
}
