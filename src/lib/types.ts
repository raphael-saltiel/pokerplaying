// ===================== Types partagés =====================

export const STARTING_BALANCE = 10000;

export type GameType = "roulette" | "blackjack" | "poker";

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
  | "split" // à cheval : 2 numéros adjacents
  | "corner" // carré : 4 numéros
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
  numbers?: number[]; // pour split (2) / corner (4)
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
  deadline: number | null; // timestamp ms : auto-spin / auto nouveau tour
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

export type HandStatus = "playing" | "stand" | "bust" | "blackjack" | "done";

export type SeatResult =
  | "win"
  | "lose"
  | "push"
  | "blackjack"
  | "surrender"
  | null;

// Une main de blackjack (un siège peut en avoir plusieurs après un split).
export interface BJHand {
  cards: Card[];
  bet: number;
  status: HandStatus;
  doubled: boolean;
  splitAce: boolean; // main issue d'un split d'As (une seule carte)
  result: SeatResult;
  payout: number; // gain net de cette main (peut être négatif)
}

export interface Seat {
  playerId: string;
  name: string;
  baseBet: number; // mise posée pendant la phase de mise
  hands: BJHand[]; // mains en jeu (>1 après split)
  insurance: number; // mise d'assurance engagée
  insuranceDecided: boolean; // a répondu à l'assurance
  insuranceResult?: "win" | "lose" | null; // pour l'affichage
}

export interface BlackjackState {
  phase: "betting" | "insurance" | "playing" | "payout";
  seats: (Seat | null)[]; // longueur fixe = nombre de places
  dealer: { cards: Card[]; hidden: boolean };
  turnSeat: number | null;
  turnHand: number; // index de la main active dans le siège
  round: number;
  message: string;
  deadline: number | null; // timestamp ms : auto-distribution / tour / nouveau tour
}

export const MAX_SPLIT_HANDS = 4;

export const BLACKJACK_SEATS = 5;

// ---------------------- Poker (Texas Hold'em) ----------------------

export type PokerStreet = "preflop" | "flop" | "turn" | "river" | "showdown";

export interface PokerSeat {
  playerId: string;
  name: string;
  stack: number; // jetons devant le joueur, à la table
  bet: number; // engagé sur la street courante
  committed: number; // engagé total sur la main (pour les side pots)
  folded: boolean;
  allIn: boolean;
  acted: boolean; // a agi depuis la dernière relance
  hasCards: boolean; // en jeu cette main
  cards?: Card[]; // renseigné UNIQUEMENT à l'abattage (révélation publique)
  sittingOut: boolean; // assis mais pas dans la main (stack 0 ou arrivé en cours)
  lastAction?: string; // pour l'affichage : "Suit", "Relance 200"…
}

export interface PokerWinner {
  playerId: string;
  name: string;
  amount: number;
  hand?: string; // nom de la main gagnante
}

export interface PokerState {
  phase: "waiting" | "playing" | "showdown";
  seats: (PokerSeat | null)[];
  board: Card[]; // cartes communes
  pot: number;
  street: PokerStreet;
  button: number; // siège du bouton donneur
  currentBet: number; // mise la plus haute à suivre sur la street
  minRaise: number; // incrément minimal de relance
  toAct: number | null; // siège dont c'est le tour
  smallBlind: number;
  bigBlind: number;
  handNo: number;
  deadline: number | null; // timestamp ms : auto-action (tour) / auto-départ
  winners?: PokerWinner[];
  message: string;
}

export const POKER_SEATS = 6;
