import type { Card } from "@/lib/types";

export function PlayingCard({ card, hidden }: { card?: Card; hidden?: boolean }) {
  if (hidden || !card) {
    return <div className="playing-card back animate-deal" aria-label="carte cachée" />;
  }
  const red = card.suit === "♥" || card.suit === "♦";
  return (
    <div className={`playing-card animate-deal ${red ? "red" : ""}`}>
      <span className="text-sm leading-none">
        {card.rank}
        {card.suit}
      </span>
      <span className="self-center text-xl leading-none">{card.suit}</span>
      <span className="self-end rotate-180 text-sm leading-none">
        {card.rank}
        {card.suit}
      </span>
    </div>
  );
}
