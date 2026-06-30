import { buildShoe, handTotal, isBlackjack } from "./cards";
import type { BlackjackState, Card, Seat } from "@/lib/types";

const DEALER_STANDS_AT = 17; // le croupier tire jusqu'à 17 (reste sur tout 17)

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

/** Indice de la prochaine place "en jeu" à partir de `from` inclus. */
function nextPlayingSeat(state: BlackjackState, from: number): number | null {
  for (let i = from; i < state.seats.length; i++) {
    if (state.seats[i]?.status === "playing") return i;
  }
  return null;
}

/**
 * Distribue un nouveau tour. Les places occupées avec une mise reçoivent 2 cartes,
 * le croupier 2 (dont 1 cachée). Renvoie le nouvel état + le sabot restant.
 */
export function dealRound(
  state: BlackjackState,
  deck: Card[]
): { state: BlackjackState; deck: Card[] } {
  let shoe = deck.slice();
  if (shoe.length < 30) shoe = buildShoe(4); // re-mélange si sabot trop court
  const draw = (): Card => shoe.pop() as Card;

  const seats = state.seats.map((s) => {
    if (!s) return null;
    if (s.bet > 0) {
      return { ...s, cards: [] as Card[], status: "playing", doubled: false, result: null, payout: 0 } as Seat;
    }
    // assis sans mise : ne joue pas ce tour
    return { ...s, cards: [] as Card[], status: "waiting", result: null, payout: 0 } as Seat;
  });

  const dealer: Card[] = [];
  for (let round = 0; round < 2; round++) {
    for (const s of seats) {
      if (s && s.bet > 0) s.cards.push(draw());
    }
    dealer.push(draw());
  }

  // blackjacks naturels
  for (const s of seats) {
    if (s && s.bet > 0 && isBlackjack(s.cards)) s.status = "blackjack";
  }

  const newState: BlackjackState = {
    ...state,
    seats,
    dealer: { cards: dealer, hidden: true },
    phase: "playing",
    turnSeat: null,
    round: state.round + 1,
    message: "Distribution…",
  };

  const first = nextPlayingSeat(newState, 0);
  newState.turnSeat = first;
  if (first === null) {
    // personne à jouer (que des blackjacks) -> au croupier
    return resolveDealer(newState, shoe);
  }
  newState.message = `Au tour de ${seats[first]!.name}.`;
  return { state: newState, deck: shoe };
}

export function hit(
  state: BlackjackState,
  deck: Card[],
  seatIndex: number
): { state: BlackjackState; deck: Card[] } {
  const shoe = deck.slice();
  const s = state.seats[seatIndex];
  if (!s) return { state, deck };
  const seats = clone(state.seats);
  const seat = seats[seatIndex]!;
  seat.cards.push(shoe.pop() as Card);
  if (handTotal(seat.cards).total > 21) {
    seat.status = "bust";
  }
  let ns: BlackjackState = { ...state, seats };
  if (seat.status === "bust") {
    return advance(ns, seatIndex, shoe);
  }
  return { state: ns, deck: shoe };
}

export function stand(
  state: BlackjackState,
  deck: Card[],
  seatIndex: number
): { state: BlackjackState; deck: Card[] } {
  const seats = clone(state.seats);
  seats[seatIndex]!.status = "stand";
  return advance({ ...state, seats }, seatIndex, deck.slice());
}

export function double(
  state: BlackjackState,
  deck: Card[],
  seatIndex: number
): { state: BlackjackState; deck: Card[] } {
  const shoe = deck.slice();
  const seats = clone(state.seats);
  const seat = seats[seatIndex]!;
  seat.bet = seat.bet * 2; // mise supplémentaire déjà débitée côté route
  seat.doubled = true;
  seat.cards.push(shoe.pop() as Card);
  if (handTotal(seat.cards).total > 21) seat.status = "bust";
  else seat.status = "stand";
  return advance({ ...state, seats }, seatIndex, shoe);
}

/** Passe au joueur suivant, ou lance le croupier si plus personne. */
function advance(
  state: BlackjackState,
  fromSeat: number,
  deck: Card[]
): { state: BlackjackState; deck: Card[] } {
  const next = nextPlayingSeat(state, fromSeat + 1);
  if (next === null) {
    return resolveDealer(state, deck);
  }
  return {
    state: { ...state, turnSeat: next, message: `Au tour de ${state.seats[next]!.name}.` },
    deck,
  };
}

/** Le croupier joue puis on résout toutes les mains. */
function resolveDealer(
  state: BlackjackState,
  deck: Card[]
): { state: BlackjackState; deck: Card[] } {
  const shoe = deck.slice();
  const dealerCards = state.dealer.cards.slice();

  // Le croupier ne tire que s'il reste au moins une main non bust à battre.
  const anyLive = state.seats.some(
    (s) => s && s.bet > 0 && (s.status === "stand" || s.status === "blackjack")
  );
  if (anyLive) {
    while (handTotal(dealerCards).total < DEALER_STANDS_AT) {
      dealerCards.push(shoe.pop() as Card);
    }
  }

  const dealerTotal = handTotal(dealerCards).total;
  const dealerBJ = isBlackjack(dealerCards);
  const dealerBust = dealerTotal > 21;

  const seats = clone(state.seats) as (Seat | null)[];
  for (const s of seats) {
    if (!s || s.bet <= 0) continue;
    if (s.status === "bust") {
      s.result = "lose";
      s.payout = -s.bet;
      continue;
    }
    const playerBJ = s.status === "blackjack";
    const playerTotal = handTotal(s.cards).total;
    if (playerBJ) {
      if (dealerBJ) {
        s.result = "push";
        s.payout = 0;
      } else {
        s.result = "blackjack";
        s.payout = Math.round(s.bet * 1.5);
      }
    } else if (dealerBJ) {
      s.result = "lose";
      s.payout = -s.bet;
    } else if (dealerBust || playerTotal > dealerTotal) {
      s.result = "win";
      s.payout = s.bet;
    } else if (playerTotal === dealerTotal) {
      s.result = "push";
      s.payout = 0;
    } else {
      s.result = "lose";
      s.payout = -s.bet;
    }
  }

  const ns: BlackjackState = {
    ...state,
    seats,
    dealer: { cards: dealerCards, hidden: false },
    phase: "payout",
    turnSeat: null,
    message: dealerBust
      ? `Le croupier saute (${dealerTotal}) !`
      : `Le croupier reste à ${dealerTotal}.`,
  };
  return { state: ns, deck: shoe };
}

/**
 * Crédits (mise + gain) à reverser par joueur après résolution.
 * Les mises ayant été débitées à la mise, on reverse le retour brut.
 */
export function payoutCredits(state: BlackjackState): Record<string, number> {
  const credits: Record<string, number> = {};
  for (const s of state.seats) {
    if (!s || s.bet <= 0 || !s.result) continue;
    let gross = 0;
    if (s.result === "blackjack") gross = s.bet + Math.round(s.bet * 1.5);
    else if (s.result === "win") gross = s.bet * 2;
    else if (s.result === "push") gross = s.bet;
    else gross = 0;
    if (gross > 0) credits[s.playerId] = (credits[s.playerId] ?? 0) + gross;
  }
  return credits;
}

/** Réinitialise pour un nouveau tour en gardant les joueurs assis. */
export function resetForNewRound(state: BlackjackState): BlackjackState {
  const seats = state.seats.map((s) =>
    s
      ? { ...s, bet: 0, cards: [], status: "waiting", doubled: false, result: null, payout: 0 }
      : null
  ) as (Seat | null)[];
  return {
    ...state,
    seats,
    dealer: { cards: [], hidden: true },
    phase: "betting",
    turnSeat: null,
    message: "Placez vos mises.",
  };
}
