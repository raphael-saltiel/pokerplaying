import { BLACKJACK_SEATS, POKER_SEATS, type GameType } from "@/lib/types";

export function initialState(game: GameType) {
  if (game === "roulette") {
    return {
      phase: "betting",
      players: [],
      bets: [],
      lastResult: null,
      history: [],
      spinId: 0,
    };
  }
  if (game === "poker") {
    return {
      phase: "waiting",
      seats: Array(POKER_SEATS).fill(null),
      board: [],
      pot: 0,
      street: "preflop",
      button: 0,
      currentBet: 0,
      minRaise: 50,
      toAct: null,
      smallBlind: 25,
      bigBlind: 50,
      handNo: 0,
      deadline: null,
      message: "En attente de joueurs…",
    };
  }
  // blackjack
  return {
    phase: "betting",
    seats: Array(BLACKJACK_SEATS).fill(null),
    dealer: { cards: [], hidden: true },
    turnSeat: null,
    round: 0,
    message: "Prenez une place et misez.",
  };
}
