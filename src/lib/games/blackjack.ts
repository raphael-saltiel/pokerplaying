import { buildShoe, handTotal, isBlackjack, cardValue } from "./cards";
import { MAX_SPLIT_HANDS, type BJHand, type BlackjackState, type Card, type Seat } from "@/lib/types";

const DEALER_STANDS_AT = 17; // le croupier tire jusqu'à 17 (reste sur tout 17)

// Durées (ms) des minuteurs.
export const BJ_BET_MS = 20000; // décompte avant distribution auto
export const BJ_TURN_MS = 20000; // temps pour jouer son tour (sinon "Rester")
export const BJ_INSURANCE_MS = 15000; // temps pour décider de l'assurance
export const BJ_PAYOUT_MS = 8000; // affichage des gains avant nouveau tour

/** Échéance du minuteur selon la phase atteinte. */
export function bjDeadline(state: BlackjackState, now: number): number | null {
  if (state.phase === "playing") return now + BJ_TURN_MS;
  if (state.phase === "insurance") return now + BJ_INSURANCE_MS;
  if (state.phase === "payout") return now + BJ_PAYOUT_MS;
  return state.deadline ?? null;
}

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

function makeHand(bet: number): BJHand {
  return { cards: [], bet, status: "playing", doubled: false, splitAce: false, result: null, payout: 0 };
}

/** Prochaine main jouable strictement après (seat, hand). */
function findNext(
  state: BlackjackState,
  seat: number,
  hand: number
): { s: number; h: number } | null {
  const n = state.seats.length;
  for (let si = seat; si < n; si++) {
    const st = state.seats[si];
    if (!st) continue;
    const startH = si === seat ? hand + 1 : 0;
    for (let hi = startH; hi < st.hands.length; hi++) {
      if (st.hands[hi].status === "playing") return { s: si, h: hi };
    }
  }
  return null;
}

// ---------------------------------------------------------------
//  Distribution
// ---------------------------------------------------------------

export function dealRound(
  state: BlackjackState,
  deck: Card[]
): { state: BlackjackState; deck: Card[] } {
  let shoe = deck.slice();
  if (shoe.length < 40) shoe = buildShoe(6);
  const draw = (): Card => shoe.pop() as Card;

  const s = clone(state);
  s.seats = s.seats.map((seat) => {
    if (!seat) return null;
    if (seat.baseBet > 0) {
      const h = makeHand(seat.baseBet);
      return { ...seat, hands: [h], insurance: 0, insuranceDecided: false, insuranceResult: null } as Seat;
    }
    return { ...seat, hands: [], insurance: 0, insuranceDecided: false, insuranceResult: null } as Seat;
  });

  const dealer: Card[] = [];
  for (let round = 0; round < 2; round++) {
    for (const seat of s.seats) {
      if (seat && seat.hands.length > 0) seat.hands[0].cards.push(draw());
    }
    dealer.push(draw());
  }
  s.dealer = { cards: dealer, hidden: true };

  // Blackjacks naturels des joueurs.
  for (const seat of s.seats) {
    if (seat && seat.hands.length > 0 && isBlackjack(seat.hands[0].cards)) {
      seat.hands[0].status = "blackjack";
    }
  }

  const up = dealer[0];
  s.round = state.round + 1;
  s.turnHand = 0;

  if (up.rank === "A") {
    // Assurance proposée.
    s.phase = "insurance";
    s.turnSeat = null;
    s.message = "Le croupier montre un As — assurance ?";
    // les sièges sans mise n'ont pas à décider
    for (const seat of s.seats) {
      if (seat && seat.hands.length === 0) seat.insuranceDecided = true;
    }
    return { state: s, deck: shoe };
  }

  if (cardValue(up) === 10) {
    // Peek : le croupier vérifie s'il a blackjack.
    if (isBlackjack(dealer)) {
      return { state: resolveDealer(s, shoe), deck: shoe };
    }
  }

  return { state: startPlay(s, shoe), deck: shoe };
}

/** Passe en phase de jeu (ou résout si personne ne joue). */
function startPlay(s: BlackjackState, shoe: Card[]): BlackjackState {
  s.phase = "playing";
  const first = findNext(s, 0, -1);
  if (!first) return resolveDealer(s, shoe);
  s.turnSeat = first.s;
  s.turnHand = first.h;
  s.message = `Au tour de ${s.seats[first.s]!.name}.`;
  return s;
}

// ---------------------------------------------------------------
//  Assurance
// ---------------------------------------------------------------

export function setInsurance(
  state: BlackjackState,
  seatIndex: number,
  amount: number
): BlackjackState | null {
  if (state.phase !== "insurance") return null;
  const s = clone(state);
  const seat = s.seats[seatIndex];
  if (!seat || seat.hands.length === 0 || seat.insuranceDecided) return null;
  const max = Math.floor(seat.hands[0].bet / 2);
  const amt = Math.max(0, Math.min(Math.floor(amount), max));
  seat.insurance = amt;
  seat.insuranceDecided = true;
  return s;
}

export function allInsuranceDecided(state: BlackjackState): boolean {
  return state.seats.every((seat) => !seat || seat.hands.length === 0 || seat.insuranceDecided);
}

/** Termine la phase d'assurance : le croupier vérifie son blackjack. */
export function finishInsurance(
  state: BlackjackState,
  deck: Card[]
): { state: BlackjackState; deck: Card[] } {
  const s = clone(state);
  const shoe = deck.slice();
  if (isBlackjack(s.dealer.cards)) {
    return { state: resolveDealer(s, shoe), deck: shoe };
  }
  return { state: startPlay(s, shoe), deck: shoe };
}

// ---------------------------------------------------------------
//  Actions du joueur (sur la main active)
// ---------------------------------------------------------------

function activeHand(s: BlackjackState): BJHand | null {
  if (s.turnSeat == null) return null;
  const seat = s.seats[s.turnSeat];
  return seat?.hands[s.turnHand] ?? null;
}

export function hit(state: BlackjackState, deck: Card[]): { state: BlackjackState; deck: Card[] } {
  const s = clone(state);
  const shoe = deck.slice();
  const h = activeHand(s)!;
  h.cards.push(shoe.pop() as Card);
  const total = handTotal(h.cards).total;
  if (total > 21) {
    h.status = "bust";
    return advance(s, shoe);
  }
  // À 21 il n'y a plus rien à faire : on reste automatiquement.
  if (total === 21) {
    h.status = "stand";
    return advance(s, shoe);
  }
  return { state: s, deck: shoe };
}

export function stand(state: BlackjackState, deck: Card[]): { state: BlackjackState; deck: Card[] } {
  const s = clone(state);
  const h = activeHand(s)!;
  h.status = "stand";
  return advance(s, deck.slice());
}

export function double(state: BlackjackState, deck: Card[]): { state: BlackjackState; deck: Card[] } {
  const s = clone(state);
  const shoe = deck.slice();
  const h = activeHand(s)!;
  h.bet *= 2; // mise supplémentaire déjà débitée côté route
  h.doubled = true;
  h.cards.push(shoe.pop() as Card);
  h.status = handTotal(h.cards).total > 21 ? "bust" : "stand";
  return advance(s, shoe);
}

export function split(state: BlackjackState, deck: Card[]): { state: BlackjackState; deck: Card[] } {
  const s = clone(state);
  const shoe = deck.slice();
  const seat = s.seats[s.turnSeat!]!;
  const h = seat.hands[s.turnHand];
  const isAce = h.cards[0].rank === "A";
  const moved = h.cards.pop() as Card;
  const nh = makeHand(h.bet); // mise supplémentaire déjà débitée côté route
  nh.cards = [moved];
  // une carte pour chaque main
  h.cards.push(shoe.pop() as Card);
  nh.cards.push(shoe.pop() as Card);
  seat.hands.push(nh);

  if (isAce) {
    // Split d'As : une seule carte chacune, on ne joue plus.
    h.status = "stand";
    h.splitAce = true;
    nh.status = "stand";
    nh.splitAce = true;
    return advance(s, shoe);
  }
  // sinon on continue sur la main courante
  h.status = "playing";
  nh.status = "playing";
  return { state: s, deck: shoe };
}

export function surrender(state: BlackjackState, deck: Card[]): { state: BlackjackState; deck: Card[] } {
  const s = clone(state);
  const h = activeHand(s)!;
  h.status = "done";
  h.result = "surrender";
  h.payout = Math.floor(h.bet / 2) - h.bet;
  return advance(s, deck.slice());
}

/** Passe à la main suivante, ou déclenche le croupier. */
function advance(s: BlackjackState, shoe: Card[]): { state: BlackjackState; deck: Card[] } {
  const next = findNext(s, s.turnSeat!, s.turnHand);
  if (next) {
    s.turnSeat = next.s;
    s.turnHand = next.h;
    s.message = `Au tour de ${s.seats[next.s]!.name}.`;
    return { state: s, deck: shoe };
  }
  return { state: resolveDealer(s, shoe), deck: shoe };
}

// ---------------------------------------------------------------
//  Croupier + résolution
// ---------------------------------------------------------------

function resolveDealer(s: BlackjackState, shoe: Card[]): BlackjackState {
  const dealerCards = s.dealer.cards.slice();
  const dealerBJ = isBlackjack(dealerCards);

  // Le croupier tire s'il reste au moins une main vivante à battre.
  const anyLive = s.seats.some(
    (seat) =>
      seat &&
      seat.hands.some((h) => h.status === "stand" || h.status === "blackjack")
  );
  if (!dealerBJ && anyLive) {
    while (handTotal(dealerCards).total < DEALER_STANDS_AT) {
      dealerCards.push(shoe.pop() as Card);
    }
  }
  const dealerTotal = handTotal(dealerCards).total;
  const dealerBust = dealerTotal > 21;

  for (const seat of s.seats) {
    if (!seat) continue;
    // Assurance
    if (seat.insurance > 0) seat.insuranceResult = dealerBJ ? "win" : "lose";

    for (const h of seat.hands) {
      if (h.result === "surrender") continue; // déjà réglé
      if (h.status === "bust") {
        h.result = "lose";
        h.payout = -h.bet;
        continue;
      }
      const playerBJ = h.status === "blackjack";
      const playerTotal = handTotal(h.cards).total;
      if (playerBJ) {
        if (dealerBJ) {
          h.result = "push";
          h.payout = 0;
        } else {
          h.result = "blackjack";
          h.payout = Math.floor(h.bet * 1.5);
        }
      } else if (dealerBJ) {
        h.result = "lose";
        h.payout = -h.bet;
      } else if (dealerBust || playerTotal > dealerTotal) {
        h.result = "win";
        h.payout = h.bet;
      } else if (playerTotal === dealerTotal) {
        h.result = "push";
        h.payout = 0;
      } else {
        h.result = "lose";
        h.payout = -h.bet;
      }
    }
  }

  s.dealer = { cards: dealerCards, hidden: false };
  s.phase = "payout";
  s.turnSeat = null;
  s.message = dealerBJ
    ? "Blackjack du croupier !"
    : dealerBust
    ? `Le croupier saute (${dealerTotal}) !`
    : `Le croupier reste à ${dealerTotal}.`;
  return s;
}

/** Retour brut d'une main réglée (mise incluse). */
function handGross(h: BJHand): number {
  switch (h.result) {
    case "blackjack":
      return h.bet + Math.floor(h.bet * 1.5);
    case "win":
      return h.bet * 2;
    case "push":
      return h.bet;
    case "surrender":
      return Math.floor(h.bet / 2);
    default:
      return 0; // lose
  }
}

/** Crédits (mise + gain) à reverser par joueur après résolution. */
export function payoutCredits(state: BlackjackState): Record<string, number> {
  const credits: Record<string, number> = {};
  for (const seat of state.seats) {
    if (!seat) continue;
    let gross = 0;
    for (const h of seat.hands) gross += handGross(h);
    if (seat.insurance > 0 && seat.insuranceResult === "win") gross += seat.insurance * 3;
    if (gross > 0) credits[seat.playerId] = (credits[seat.playerId] ?? 0) + gross;
  }
  return credits;
}

export function resetForNewRound(state: BlackjackState): BlackjackState {
  const seats = state.seats.map((s) =>
    s
      ? { ...s, baseBet: 0, hands: [], insurance: 0, insuranceDecided: false, insuranceResult: null }
      : null
  ) as (Seat | null)[];
  return {
    ...state,
    seats,
    dealer: { cards: [], hidden: true },
    phase: "betting",
    turnSeat: null,
    turnHand: 0,
    message: "Placez vos mises.",
    deadline: null,
  };
}

// ---------------------------------------------------------------
//  Aides pour l'UI : actions légales sur la main active
// ---------------------------------------------------------------

export function legalMoves(state: BlackjackState, seatIndex: number) {
  const none = { canHit: false, canStand: false, canDouble: false, canSplit: false, canSurrender: false };
  if (state.phase !== "playing" || state.turnSeat !== seatIndex) return none;
  const seat = state.seats[seatIndex];
  if (!seat) return none;
  const h = seat.hands[state.turnHand];
  if (!h || h.status !== "playing") return none;
  const twoCards = h.cards.length === 2;
  const firstDecision = seat.hands.length === 1 && twoCards && !h.doubled;
  const sameValue = twoCards && cardValue(h.cards[0]) === cardValue(h.cards[1]);
  return {
    canHit: true,
    canStand: true,
    canDouble: twoCards,
    canSplit: sameValue && seat.hands.length < MAX_SPLIT_HANDS,
    canSurrender: firstDecision,
  };
}
