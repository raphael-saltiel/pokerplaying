// ===================== Types partagés =====================

export const STARTING_BALANCE = 10000;

export type GameType = "roulette" | "blackjack";

export interface Player {
  id: string;
  name: string;
  balance: number;
}

export interface TableRow {
  code: string;
  game: GameType;
  state: RouletteState | BlackjackState;
  host_id: string | null;
  updated_at: string;
}

// ---------------------- Roulette ----------------------

export type RouletteBetKind =
  | "number"
  | "red"
  | "black"
  | "even"
  | "odd"
  | "low"
  | "high"
  | "dozen"
  | "column";

export interface RouletteBet {
  id: string;
  playerId: string;
  name: string;
  kind: RouletteBetKind;
  value?: number; // numéro (0-36) ou index de douzaine/colonne (1-3)
  amount: number;
}

export interface RoulettePresence {
  id: string;
  name: string;
}

export interface RouletteState {
  phase: "betting" | "result";
  players: RoulettePresence[];
  bets: RouletteBet[];
  lastResult: number | null;
  history: number[];
  spinId: number; // incrémenté à chaque tirage (sync animation)
  lastPayouts?: { playerId: string; name: string; net: number }[];
}

// ---------------------- Blackjack ----------------------

export type Suit = "♠" | "♥" | "♦" | "♣";

export interface Card {
  rank:
    | "A"
    | "2"
    | "3"
    | "4"
    | "5"
    | "6"
    | "7"
    | "8"
    | "9"
    | "10"
    | "J"
    | "Q"
    | "K";
  suit: Suit;
}

export type SeatStatus =
  | "empty"
  | "waiting"
  | "playing"
  | "stand"
  | "bust"
  | "blackjack"
  | "done";

export type SeatResult = "win" | "lose" | "push" | "blackjack" | null;

export interface Seat {
  playerId: string;
  name: string;
  bet: number;
  cards: Card[];
  status: SeatStatus;
  doubled: boolean;
  result: SeatResult;
  payout: number; // gain net du round (peut être négatif)
}

export interface BlackjackState {
  phase: "betting" | "playing" | "dealer" | "payout";
  seats: (Seat | null)[]; // longueur fixe = nombre de places
  dealer: { cards: Card[]; hidden: boolean };
  turnSeat: number | null;
  round: number;
  message: string;
}

export const BLACKJACK_SEATS = 5;
