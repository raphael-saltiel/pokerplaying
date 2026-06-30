"use client";

import { useEffect, useRef, useState } from "react";
import { colorOf } from "@/lib/games/roulette";

const CELL = 56; // largeur d'une case (px)
const TARGET = 40; // index du numéro gagnant dans la bande

function pillClass(n: number): string {
  const c = colorOf(n);
  if (c === "green") return "bg-felt-light";
  if (c === "red") return "bg-red-700";
  return "bg-black/80";
}

// Bande de numéros se terminant par le résultat à l'index TARGET.
function buildStrip(result: number, seed: number): number[] {
  const arr: number[] = [];
  for (let i = 0; i < TARGET + 8; i++) {
    // pseudo-aléatoire déterministe (évite les soucis d'hydratation)
    const r = (Math.sin((i + 1) * 99.7 + seed * 13.3) * 10000) % 1;
    arr.push(Math.floor(Math.abs(r) * 37));
  }
  arr[TARGET] = result;
  return arr;
}

export function RouletteWheel({
  result,
  spinId,
}: {
  result: number | null;
  spinId: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(0);
  const [strip, setStrip] = useState<number[]>(() =>
    buildStrip(result ?? 0, spinId)
  );
  const [offset, setOffset] = useState(0);
  const [animate, setAnimate] = useState(false);

  // Mesure la largeur du conteneur (pour centrer le numéro sous le repère).
  useEffect(() => {
    const measure = () => setContainerW(containerRef.current?.clientWidth ?? 0);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // À chaque tirage : on régénère la bande et on lance l'animation.
  useEffect(() => {
    if (result == null || containerW === 0) return;
    const newStrip = buildStrip(result, spinId);
    setStrip(newStrip);

    const center = containerW / 2;
    const startOffset = center - CELL / 2; // 1re case centrée
    const endOffset = center - (TARGET + 0.5) * CELL; // case gagnante centrée

    setAnimate(false);
    setOffset(startOffset);
    // double rAF pour appliquer la position de départ avant la transition
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        setAnimate(true);
        setOffset(endOffset);
      })
    );
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinId, containerW]);

  return (
    <div
      ref={containerRef}
      className="relative mb-3 h-16 overflow-hidden rounded-xl border border-gold/30 bg-black/40"
    >
      {/* Repère central */}
      <div className="pointer-events-none absolute left-1/2 top-0 z-10 h-full w-0.5 -translate-x-1/2 bg-gold/80" />
      <div className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 border-x-8 border-t-8 border-x-transparent border-t-gold" />

      <div
        className="flex h-full items-center"
        style={{
          transform: `translateX(${offset}px)`,
          transition: animate
            ? "transform 4.2s cubic-bezier(0.12, 0.8, 0.2, 1)"
            : "none",
        }}
      >
        {strip.map((n, i) => (
          <div
            key={i}
            className={`flex h-12 shrink-0 items-center justify-center rounded-md font-bold text-white ${pillClass(
              n
            )}`}
            style={{ width: CELL - 6, margin: "0 3px" }}
          >
            {n}
          </div>
        ))}
      </div>
    </div>
  );
}
