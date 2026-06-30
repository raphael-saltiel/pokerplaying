import type { Card, Suit } from "@/lib/types";

const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];
const RANKS: Card["rank"][] = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];

/** Construit un sabot de `decks` paquets de 52 cartes, mélangé. */
export function buildShoe(decks = 4): Card[] {
  const shoe: Card[] = [];
  for (let d = 0; d < decks; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        shoe.push({ rank, suit });
      }
    }
  }
  return shuffle(shoe);
}

/** Mélange de Fisher-Yates (en place + retour). */
export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Valeur d'une carte au blackjack (As = 11, ajusté ensuite). */
export function cardValue(card: Card): number {
  if (card.rank === "A") return 11;
  if (["K", "Q", "J", "10"].includes(card.rank)) return 10;
  return parseInt(card.rank, 10);
}

/** Meilleur total d'une main + indicateur "soft" (As compté comme 11). */
export function handTotal(cards: Card[]): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += cardValue(c);
    if (c.rank === "A") aces++;
  }
  let soft = aces > 0;
  while (total > 21 && aces > 0) {
    total -= 10; // un As passe de 11 à 1
    aces--;
    soft = aces > 0;
  }
  return { total, soft };
}

export function isBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && handTotal(cards).total === 21;
}
