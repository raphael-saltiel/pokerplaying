import { BLACKJACK_SEATS, type GameType } from "@/lib/types";

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
