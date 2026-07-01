// ============================================================
//  Tickets à gratter (inspiration FDJ)
//  Mécanique commune : grille 3×3. Si un montant apparaît 3 fois,
//  le joueur gagne ce montant. Le résultat est tiré côté serveur à
//  l'achat (comme un vrai ticket pré-imprimé), la grille est ensuite
//  générée pour refléter ce résultat.
// ============================================================

export interface ScratchPrize {
  amount: number; // 0 = perdant
  weight: number; // poids pour le tirage
}

export type NeonColor = "cyan" | "magenta" | "yellow" | "green";

export interface ScratchTicket {
  id: string;
  name: string;
  tagline: string;
  price: number;
  color: NeonColor;
  prizes: ScratchPrize[]; // doit contenir au moins 5 montants > 0 distincts
}

export const GRID_SIZE = 9; // 3×3

export const TICKETS: ScratchTicket[] = [
  {
    id: "banco",
    name: "NÉON BANCO",
    tagline: "Le petit prix, les gains fréquents",
    price: 50,
    color: "green",
    prizes: [
      { amount: 0, weight: 700 },
      { amount: 50, weight: 150 },
      { amount: 100, weight: 85 },
      { amount: 250, weight: 40 },
      { amount: 500, weight: 18 },
      { amount: 1000, weight: 7 },
    ],
  },
  {
    id: "cash",
    name: "NÉON CASH",
    tagline: "L'équilibre parfait",
    price: 200,
    color: "cyan",
    prizes: [
      { amount: 0, weight: 690 },
      { amount: 100, weight: 150 },
      { amount: 200, weight: 90 },
      { amount: 500, weight: 45 },
      { amount: 2000, weight: 20 },
      { amount: 10000, weight: 5 },
    ],
  },
  {
    id: "mega",
    name: "MÉGA MILLION",
    tagline: "Le jackpot à 100 000 jetons",
    price: 1000,
    color: "magenta",
    prizes: [
      { amount: 0, weight: 1455 },
      { amount: 500, weight: 320 },
      { amount: 1000, weight: 150 },
      { amount: 5000, weight: 55 },
      { amount: 20000, weight: 16 },
      { amount: 100000, weight: 4 },
    ],
  },
  {
    id: "platine",
    name: "PLATINE",
    tagline: "Le ticket haut de gamme",
    price: 2500,
    color: "yellow",
    prizes: [
      { amount: 0, weight: 1359 },
      { amount: 1000, weight: 400 },
      { amount: 2500, weight: 170 },
      { amount: 10000, weight: 50 },
      { amount: 50000, weight: 16 },
      { amount: 250000, weight: 5 },
    ],
  },
  {
    id: "ultra",
    name: "ULTRA JACKPOT",
    tagline: "Le million est à portée de gratte",
    price: 5000,
    color: "magenta",
    prizes: [
      { amount: 0, weight: 1447 },
      { amount: 2500, weight: 360 },
      { amount: 5000, weight: 140 },
      { amount: 25000, weight: 40 },
      { amount: 100000, weight: 10 },
      { amount: 1000000, weight: 3 },
    ],
  },
];

export function getTicket(id: string): ScratchTicket | undefined {
  return TICKETS.find((t) => t.id === id);
}

/** Tire le montant gagné (0 = perdant) selon les poids. */
export function drawOutcome(ticket: ScratchTicket): number {
  const total = ticket.prizes.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const p of ticket.prizes) {
    r -= p.weight;
    if (r < 0) return p.amount;
  }
  return 0;
}

/** Remplit `n` cases depuis `symbols`, chaque symbole limité à `cap` occurrences. */
function fillCells(n: number, symbols: number[], cap: number): number[] {
  const counts: Record<number, number> = {};
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const avail = symbols.filter((s) => (counts[s] ?? 0) < cap);
    const s = avail[Math.floor(Math.random() * avail.length)];
    counts[s] = (counts[s] ?? 0) + 1;
    out.push(s);
  }
  return out;
}

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Génère la grille 3×3 cohérente avec le résultat `prize`.
 * - prize > 0 : exactement 3 cases = prize, aucun autre montant en triple.
 * - prize = 0 : aucun montant en triple.
 */
export function buildGrid(ticket: ScratchTicket, prize: number): number[] {
  const pool = ticket.prizes.filter((p) => p.amount > 0).map((p) => p.amount);
  if (prize > 0) {
    const others = pool.filter((a) => a !== prize);
    const grid = [prize, prize, prize, ...fillCells(GRID_SIZE - 3, others, 2)];
    return shuffle(grid);
  }
  return shuffle(fillCells(GRID_SIZE, pool, 2));
}

/** Montant gagnant présent dans une grille (0 si aucun triple). */
export function detectPrize(grid: number[]): number {
  const counts: Record<number, number> = {};
  for (const c of grid) counts[c] = (counts[c] ?? 0) + 1;
  let best = 0;
  for (const [amt, n] of Object.entries(counts)) {
    if (n >= 3 && +amt > best) best = +amt;
  }
  return best;
}

/** Probabilités / RTP d'un ticket (pour l'affichage type FDJ). */
export function ticketOdds(ticket: ScratchTicket) {
  const total = ticket.prizes.reduce((s, p) => s + p.weight, 0);
  const winWeight = ticket.prizes.filter((p) => p.amount > 0).reduce((s, p) => s + p.weight, 0);
  const ev = ticket.prizes.reduce((s, p) => s + (p.amount * p.weight) / total, 0);
  return {
    winProb: winWeight / total, // proba de gagner quelque chose
    oneInN: total / winWeight, // "1 chance sur N"
    rtp: ev / ticket.price, // taux de retour joueur
    table: ticket.prizes
      .filter((p) => p.amount > 0)
      .map((p) => ({ amount: p.amount, oneInN: total / p.weight })),
  };
}
