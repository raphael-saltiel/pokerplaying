import type { Card, PokerSeat, PokerState, PokerWinner } from "@/lib/types";
import { buildShoe } from "./cards";

// Durées (ms) des minuteurs.
export const POKER_TURN_MS = 25000; // temps pour agir
export const POKER_SHOWDOWN_MS = 7000; // pause avant la main suivante
export const POKER_START_MS = 6000; // décompte avant la 1re main

// ============================================================
//  Évaluation de mains (meilleure combinaison de 5 parmi 7)
// ============================================================

const RANK_VALUE: Record<string, number> = {
  "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
  "10": 10, J: 11, Q: 12, K: 13, A: 14,
};

function rv(c: Card): number {
  return RANK_VALUE[c.rank];
}

/** Plus haute carte d'une suite de 5 valeurs distinctes, ou 0 si pas de suite. */
function straightHigh(vals: number[]): number {
  const u = Array.from(new Set(vals));
  if (u.length !== 5) return 0;
  const s = u.slice().sort((a, b) => a - b);
  if (s[4] - s[0] === 4) return s[4];
  // suite "roue" A-2-3-4-5 -> hauteur 5
  if (s[0] === 2 && s[1] === 3 && s[2] === 4 && s[3] === 5 && s[4] === 14) return 5;
  return 0;
}

/** Score comparable d'une main de 5 cartes : [catégorie, ...départageurs]. */
export function evaluate5(cards: Card[]): number[] {
  const vals = cards.map(rv).sort((a, b) => b - a);
  const suits = cards.map((c) => c.suit);
  const flush = suits.every((s) => s === suits[0]);

  const countMap: Record<number, number> = {};
  for (const v of vals) countMap[v] = (countMap[v] ?? 0) + 1;
  const groups = Object.entries(countMap)
    .map(([v, c]) => ({ v: +v, c }))
    .sort((a, b) => b.c - a.c || b.v - a.v);
  const counts = groups.map((g) => g.c);

  const sh = straightHigh(vals);

  if (flush && sh) return [8, sh]; // quinte flush
  if (counts[0] === 4) return [7, groups[0].v, groups[1].v]; // carré
  if (counts[0] === 3 && counts[1] === 2) return [6, groups[0].v, groups[1].v]; // full
  if (flush) return [5, ...vals]; // couleur
  if (sh) return [4, sh]; // quinte
  if (counts[0] === 3) return [3, groups[0].v, groups[1].v, groups[2].v]; // brelan
  if (counts[0] === 2 && counts[1] === 2)
    return [2, groups[0].v, groups[1].v, groups[2].v]; // deux paires
  if (counts[0] === 2) return [1, groups[0].v, groups[1].v, groups[2].v, groups[3].v]; // paire
  return [0, ...vals]; // hauteur
}

export function cmpScore(a: number[], b: number[]): number {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x - y;
  }
  return 0;
}

const CAT_NAMES = [
  "Hauteur",
  "Paire",
  "Deux paires",
  "Brelan",
  "Quinte",
  "Couleur",
  "Full",
  "Carré",
  "Quinte flush",
];

/** Meilleure main de 5 parmi 7 cartes. */
export function best7(seven: Card[]): { score: number[]; name: string } {
  let best: number[] | null = null;
  for (let i = 0; i < seven.length; i++) {
    for (let j = i + 1; j < seven.length; j++) {
      const five = seven.filter((_, k) => k !== i && k !== j);
      const sc = evaluate5(five);
      if (!best || cmpScore(sc, best) > 0) best = sc;
    }
  }
  return { score: best!, name: CAT_NAMES[best![0]] };
}

// ============================================================
//  Machine d'état Texas Hold'em
// ============================================================

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

function occupiedWithChips(state: PokerState): number[] {
  const out: number[] = [];
  state.seats.forEach((s, i) => {
    if (s && s.stack > 0) out.push(i);
  });
  return out;
}

/** Prochain siège (sens horaire) à partir de `from` exclu satisfaisant `pred`. */
function nextSeat(
  state: PokerState,
  from: number,
  pred: (s: PokerSeat, i: number) => boolean
): number | null {
  const n = state.seats.length;
  for (let k = 1; k <= n; k++) {
    const idx = (from + k) % n;
    const s = state.seats[idx];
    if (s && pred(s, idx)) return idx;
  }
  return null;
}

function inHandNotFolded(state: PokerState): number[] {
  const out: number[] = [];
  state.seats.forEach((s, i) => {
    if (s && s.hasCards && !s.folded) out.push(i);
  });
  return out;
}

function commit(state: PokerState, seat: PokerSeat, amount: number): number {
  const x = Math.min(amount, seat.stack);
  seat.stack -= x;
  seat.bet += x;
  seat.committed += x;
  state.pot += x;
  if (seat.stack === 0) seat.allIn = true;
  return x;
}

/** Démarre une nouvelle main. Renvoie l'état, le sabot restant et les cartes privées. */
export function startHand(
  prev: PokerState,
  deckIn: Card[],
  now: number
): { state: PokerState; deck: Card[]; hole: Record<string, Card[]> } | null {
  const state = clone(prev);
  const eligible = occupiedWithChips(state);
  if (eligible.length < 2) return null;

  let deck = deckIn.slice();
  // Il faut au moins 2 cartes/joueur + 5 board + marge.
  if (deck.length < eligible.length * 2 + 8) deck = buildShoe(4);
  const draw = (): Card => deck.pop() as Card;

  // Réinitialisation des sièges. Les sièges à 0 jeton (ruinés ou partis) sont
  // libérés (le joueur devra se rasseoir avec une nouvelle cave).
  state.seats = state.seats.map((s) => {
    if (!s) return null;
    if (s.stack <= 0) return null;
    return {
      ...s,
      bet: 0,
      committed: 0,
      folded: false,
      allIn: false,
      acted: false,
      hasCards: true,
      cards: undefined,
      sittingOut: false,
      lastAction: undefined,
    };
  });

  // Bouton : prochain siège occupé après le bouton précédent.
  const firstHand = state.handNo === 0;
  state.button = firstHand
    ? eligible[0]
    : nextSeat(state, state.button, (s) => s.stack > 0) ?? eligible[0];

  const headsUp = eligible.length === 2;
  const sbIdx = headsUp
    ? state.button
    : (nextSeat(state, state.button, (s) => s.stack > 0) as number);
  const bbIdx = nextSeat(state, sbIdx, (s) => s.stack > 0) as number;

  // Blinds.
  commit(state, state.seats[sbIdx]!, state.smallBlind);
  state.seats[sbIdx]!.lastAction = "Petite blinde";
  commit(state, state.seats[bbIdx]!, state.bigBlind);
  state.seats[bbIdx]!.lastAction = "Grosse blinde";

  // Distribution des cartes privées (2 chacun).
  const hole: Record<string, Card[]> = {};
  for (let r = 0; r < 2; r++) {
    for (const i of eligible) {
      const seat = state.seats[i]!;
      (hole[seat.playerId] ??= []).push(draw());
    }
  }
  for (const i of eligible) state.seats[i]!.hasCards = true;

  state.currentBet = Math.max(state.smallBlind, state.bigBlind);
  state.minRaise = state.bigBlind;
  state.pot = state.pot; // déjà incrémenté par les blinds
  state.board = [];
  state.street = "preflop";
  state.phase = "playing";
  state.handNo += 1;
  state.winners = undefined;

  // Premier à parler : à gauche de la BB (heads-up : le bouton).
  const firstToAct = headsUp
    ? state.button
    : (nextSeat(state, bbIdx, (s) => s.hasCards && !s.folded && !s.allIn) as number);
  state.toAct = firstToAct;
  state.deadline = now + POKER_TURN_MS;
  const nm = state.seats[firstToAct]?.name ?? "";
  state.message = `Nouvelle main — à ${nm} de parler.`;

  return { state, deck, hole };
}

/** Premier à parler post-flop : à gauche du bouton. */
function firstToActPostflop(state: PokerState): number | null {
  return nextSeat(state, state.button, (s) => s.hasCards && !s.folded && !s.allIn);
}

function nextToAct(state: PokerState, from: number): number | null {
  return nextSeat(
    state,
    from,
    (s) =>
      s.hasCards &&
      !s.folded &&
      !s.allIn &&
      (!s.acted || s.bet < state.currentBet)
  );
}

/** Retourne la portion non-suivie de la plus haute mise (tapis non couvert). */
function returnUncalled(state: PokerState) {
  const live = inHandNotFolded(state).map((i) => state.seats[i]!);
  if (live.length === 0) return;
  const sorted = live.slice().sort((a, b) => b.bet - a.bet);
  const top = sorted[0];
  const second = sorted[1]?.bet ?? 0;
  const refund = top.bet - second;
  if (refund > 0) {
    top.stack += refund;
    top.bet -= refund;
    top.committed -= refund;
    state.pot -= refund;
  }
}

const STREET_ORDER: PokerState["street"][] = [
  "preflop",
  "flop",
  "turn",
  "river",
  "showdown",
];

/** Avance d'une street (distribue le board), ou abat si la river est finie. */
function advanceStreet(
  state: PokerState,
  deck: Card[],
  hole: Record<string, Card[]>,
  now: number
): { state: PokerState; deck: Card[] } {
  returnUncalled(state);

  while (true) {
    if (state.street === "river") {
      return { state: showdown(state, hole, now), deck };
    }
    // Réinitialise les mises de la street.
    for (const s of state.seats) {
      if (s && s.hasCards && !s.folded) {
        s.bet = 0;
        s.acted = false;
        s.lastAction = undefined;
      }
    }
    state.currentBet = 0;
    state.minRaise = state.bigBlind;

    const idx = STREET_ORDER.indexOf(state.street);
    const next = STREET_ORDER[idx + 1];
    const toDeal = next === "flop" ? 3 : 1;
    for (let i = 0; i < toDeal; i++) state.board.push(deck.pop() as Card);
    state.street = next;

    const canAct = state.seats.filter(
      (s) => s && s.hasCards && !s.folded && !s.allIn
    ).length;
    if (canAct >= 2) {
      const first = firstToActPostflop(state);
      state.toAct = first;
      state.deadline = now + POKER_TURN_MS;
      state.message = `${labelStreet(next)} — à ${state.seats[first!]?.name} de parler.`;
      return { state, deck };
    }
    // sinon : pas d'enchères possibles, on continue à dérouler le board
  }
}

function labelStreet(s: PokerState["street"]): string {
  return s === "flop" ? "Flop" : s === "turn" ? "Turn" : s === "river" ? "River" : "";
}

/** Distribue le(s) pot(s) à l'abattage selon les side pots. */
function showdown(
  state: PokerState,
  hole: Record<string, Card[]>,
  now: number
): PokerState {
  // Révèle les cartes des joueurs encore en lice.
  const contenders = inHandNotFolded(state);
  for (const i of contenders) {
    const seat = state.seats[i]!;
    seat.cards = hole[seat.playerId];
  }

  // Score de chaque prétendant.
  const scores: Record<number, { score: number[]; name: string }> = {};
  for (const i of contenders) {
    const seat = state.seats[i]!;
    scores[i] = best7([...(seat.cards ?? []), ...state.board]);
  }

  // Side pots à partir des `committed`.
  const pots = buildSidePots(state);
  const winAgg: Record<number, number> = {};
  const winHand: Record<number, string> = {};

  for (const pot of pots) {
    const eligible = pot.eligible.filter((i) => contenders.includes(i));
    const pool = eligible.length > 0 ? eligible : pot.eligible; // fallback
    if (pool.length === 0) continue;
    // meilleur score parmi les éligibles
    let best: number[] | null = null;
    for (const i of pool) if (!best || cmpScore(scores[i]?.score ?? [0], best) > 0) best = scores[i]?.score ?? [0];
    const winners = pool.filter((i) => cmpScore(scores[i]?.score ?? [0], best!) === 0);
    const share = Math.floor(pot.amount / winners.length);
    let remainder = pot.amount - share * winners.length;
    // l'éventuel jeton impair va au premier à gauche du bouton
    const ordered = orderFromButton(state, winners);
    for (const i of ordered) {
      let amt = share;
      if (remainder > 0) {
        amt += 1;
        remainder -= 1;
      }
      state.seats[i]!.stack += amt;
      winAgg[i] = (winAgg[i] ?? 0) + amt;
      if (scores[i]) winHand[i] = scores[i].name;
    }
  }

  const winners: PokerWinner[] = Object.keys(winAgg).map((k) => {
    const i = +k;
    return {
      playerId: state.seats[i]!.playerId,
      name: state.seats[i]!.name,
      amount: winAgg[i],
      hand: winHand[i],
    };
  });

  state.phase = "showdown";
  state.street = "showdown";
  state.toAct = null;
  state.pot = 0;
  state.winners = winners;
  state.deadline = now + POKER_SHOWDOWN_MS;
  state.message =
    winners.length === 1
      ? `${winners[0].name} gagne ${winners[0].amount} (${winners[0].hand}).`
      : "Abattage — pot partagé.";
  return state;
}

function orderFromButton(state: PokerState, idxs: number[]): number[] {
  const n = state.seats.length;
  return idxs
    .slice()
    .sort(
      (a, b) =>
        ((a - state.button + n) % n) - ((b - state.button + n) % n)
    );
}

interface SidePot {
  amount: number;
  eligible: number[];
}

function buildSidePots(state: PokerState): SidePot[] {
  const remaining = state.seats
    .map((s, i) => ({ i, folded: s?.folded ?? true, rem: s?.committed ?? 0 }))
    .filter((r) => r.rem > 0);
  const pots: SidePot[] = [];
  while (remaining.some((r) => r.rem > 0)) {
    const min = Math.min(...remaining.filter((r) => r.rem > 0).map((r) => r.rem));
    let amount = 0;
    const participants: number[] = [];
    for (const r of remaining) {
      if (r.rem > 0) {
        amount += min;
        r.rem -= min;
        participants.push(r.i);
      }
    }
    const eligible = participants.filter((i) => !(state.seats[i]?.folded ?? true));
    pots.push({ amount, eligible });
  }
  return pots;
}

/** Termine la main quand il ne reste qu'un joueur (tous les autres couchés). */
function awardLastStanding(state: PokerState, now: number): PokerState {
  returnUncalled(state);
  const live = inHandNotFolded(state);
  const i = live[0];
  const seat = state.seats[i]!;
  const amount = state.pot;
  seat.stack += amount;
  state.pot = 0;
  state.phase = "showdown";
  state.street = "showdown";
  state.toAct = null;
  state.winners = [{ playerId: seat.playerId, name: seat.name, amount }];
  state.deadline = now + POKER_SHOWDOWN_MS;
  state.message = `${seat.name} remporte le pot (${amount}).`;
  return state;
}

export type PokerAction = "fold" | "check" | "call" | "raise" | "timeout";

/**
 * Applique l'action d'un joueur. Renvoie le nouvel état + sabot, ou null si invalide.
 * `amount` = montant TOTAL visé sur la street (pour "raise").
 */
export function applyAction(
  prev: PokerState,
  deckIn: Card[],
  hole: Record<string, Card[]>,
  seatIndex: number,
  action: PokerAction,
  amount: number,
  now: number
): { state: PokerState; deck: Card[] } | null {
  if (prev.phase !== "playing" || prev.toAct !== seatIndex) return null;
  const state = clone(prev);
  const deck = deckIn.slice();
  const seat = state.seats[seatIndex];
  if (!seat || seat.folded || seat.allIn) return null;

  let act = action;
  if (act === "timeout") {
    // auto : check si possible, sinon se coucher
    act = seat.bet === state.currentBet ? "check" : "fold";
  }

  const toCall = state.currentBet - seat.bet;

  switch (act) {
    case "fold":
      seat.folded = true;
      seat.acted = true;
      seat.lastAction = "Se couche";
      break;
    case "check":
      if (toCall > 0) return null;
      seat.acted = true;
      seat.lastAction = "Check";
      break;
    case "call": {
      if (toCall <= 0) {
        seat.acted = true;
        seat.lastAction = "Check";
        break;
      }
      const paid = commit(state, seat, toCall);
      seat.acted = true;
      seat.lastAction = seat.allIn ? `Tapis ${paid}` : "Suit";
      break;
    }
    case "raise": {
      // Tapis : on plafonne au stack disponible.
      let target = Math.floor(amount);
      const maxTarget = seat.bet + seat.stack;
      if (target >= maxTarget) target = maxTarget; // all-in
      const raiseSize = target - state.currentBet;
      const isAllIn = target === maxTarget;
      if (target <= state.currentBet) return null; // pas une vraie relance
      if (!isAllIn && raiseSize < state.minRaise) return null; // relance trop faible
      const pay = target - seat.bet;
      if (pay > seat.stack) return null;
      commit(state, seat, pay);
      const wasBet = state.currentBet > 0 && state.currentBet > state.bigBlind ? true : state.currentBet > 0;
      if (raiseSize >= state.minRaise) state.minRaise = raiseSize;
      state.currentBet = Math.max(state.currentBet, target);
      seat.acted = true;
      seat.lastAction = seat.allIn
        ? `Tapis ${target}`
        : wasBet
        ? `Relance ${target}`
        : `Mise ${target}`;
      break;
    }
    default:
      return null;
  }

  // Plus qu'un joueur en lice -> il rafle le pot.
  const live = inHandNotFolded(state);
  if (live.length === 1) {
    return { state: awardLastStanding(state, now), deck };
  }

  // Joueur suivant à parler ?
  const next = nextToAct(state, seatIndex);
  if (next !== null) {
    state.toAct = next;
    state.deadline = now + POKER_TURN_MS;
    state.message = `À ${state.seats[next]?.name} de parler.`;
    return { state, deck };
  }

  // Tour d'enchères terminé -> street suivante / abattage.
  return advanceStreet(state, deck, hole, now);
}

/**
 * Couche un siège même si ce n'est pas son tour (départ en cours de main).
 * Gère l'avancement du tour et la victoire du dernier en lice.
 */
export function forceFold(
  prev: PokerState,
  deckIn: Card[],
  hole: Record<string, Card[]>,
  seatIndex: number,
  now: number
): { state: PokerState; deck: Card[] } {
  if (prev.phase === "playing" && prev.toAct === seatIndex) {
    const out = applyAction(prev, deckIn, hole, seatIndex, "fold", 0, now);
    if (out) return out;
  }
  const state = clone(prev);
  const deck = deckIn.slice();
  const seat = state.seats[seatIndex];
  if (seat && seat.hasCards && !seat.folded) {
    seat.folded = true;
    seat.lastAction = "Quitte";
    const live = inHandNotFolded(state);
    if (live.length === 1) return { state: awardLastStanding(state, now), deck };
  }
  return { state, deck };
}

/** Vue "légale" pour l'UI : que peut faire le joueur dont c'est le tour. */
export function legalFor(state: PokerState, seatIndex: number) {
  const seat = state.seats[seatIndex];
  if (!seat || state.toAct !== seatIndex || state.phase !== "playing") {
    return { canCheck: false, callAmount: 0, minRaiseTo: 0, maxRaiseTo: 0 };
  }
  const toCall = Math.max(0, state.currentBet - seat.bet);
  const canCheck = toCall === 0;
  const maxRaiseTo = seat.bet + seat.stack;
  const minRaiseTo = Math.min(maxRaiseTo, state.currentBet + state.minRaise);
  return {
    canCheck,
    callAmount: Math.min(toCall, seat.stack),
    minRaiseTo,
    maxRaiseTo,
  };
}
