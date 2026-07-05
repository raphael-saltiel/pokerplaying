"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { colorOf, WHEEL_ORDER } from "@/lib/games/roulette";

const SIZE = 240;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R_OUT = 116;
const R_IN = 60;
const R_LABEL = 104;
const STEP = 360 / WHEEL_ORDER.length;

function polar(r: number, deg: number) {
  const a = ((deg - 90) * Math.PI) / 180;
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
}

// Segments sombres feutrés (style DARKPOOL), la couleur vive est réservée
// à la jante, au repère et au numéro affiché au centre.
function sliceColor(n: number): string {
  const c = colorOf(n);
  if (c === "green") return "#0f3d1e";
  if (c === "red") return "#3d0f2e";
  return "#0b1216";
}

function centerColor(n: number | null): string {
  if (n == null) return "rgba(255,255,255,0.3)";
  const c = colorOf(n);
  if (c === "green") return "#7CFF00";
  if (c === "red") return "#FF2BD6";
  return "#EFFBFD";
}

export function RouletteWheel({ result, spinId }: { result: number | null; spinId: number }) {
  const [rot, setRot] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const rotRef = useRef(0);
  const lastSpin = useRef(-1);

  // Géométrie statique de la roue (calculée une fois).
  const { slices, labels } = useMemo(() => {
    const slices = WHEEL_ORDER.map((n, i) => {
      const start = i * STEP - STEP / 2;
      const end = i * STEP + STEP / 2;
      const p1 = polar(R_OUT, start);
      const p2 = polar(R_OUT, end);
      const q1 = polar(R_IN, end);
      const q2 = polar(R_IN, start);
      const d = `M${p1.x},${p1.y} A${R_OUT},${R_OUT} 0 0 1 ${p2.x},${p2.y} L${q1.x},${q1.y} A${R_IN},${R_IN} 0 0 0 ${q2.x},${q2.y} Z`;
      return { d, fill: sliceColor(n) };
    });
    const labels = WHEEL_ORDER.map((n, i) => {
      const p = polar(R_LABEL, i * STEP);
      return { n, x: p.x, y: p.y, rot: i * STEP };
    });
    return { slices, labels };
  }, []);

  // À chaque tirage : on fait tourner la roue pour amener le numéro en haut.
  useEffect(() => {
    if (result == null) return;
    const idx = WHEEL_ORDER.indexOf(result);
    if (idx < 0) return;
    const a = idx * STEP; // angle du numéro (0 = haut)

    if (lastSpin.current === -1) {
      // premier rendu : on se positionne sans animation
      const base = ((-a % 360) + 360) % 360;
      rotRef.current = base;
      setSpinning(false);
      setRot(base);
      lastSpin.current = spinId;
      return;
    }
    if (lastSpin.current === spinId) return;
    lastSpin.current = spinId;

    // 6 tours + ajustement pour finir pile sur le numéro (mod 360 = -a)
    const target = rotRef.current + 360 * 6;
    const adjust = ((((-a - target) % 360) + 360) % 360);
    const next = target + adjust;
    rotRef.current = next;
    setSpinning(true);
    setRot(next);
  }, [spinId, result]);

  return (
    <div className="relative mx-auto mb-3" style={{ width: SIZE, height: SIZE }}>
      {/* Halo phosphore */}
      <div className="pointer-events-none absolute inset-2 rounded-full shadow-[0_0_40px_rgba(0,240,255,0.3),inset_0_0_30px_rgba(255,43,214,0.15)]" />

      {/* Rotor */}
      <div
        style={{
          transform: `rotate(${rot}deg)`,
          transformOrigin: "50% 50%",
          transition: spinning ? "transform 4.6s cubic-bezier(0.16, 0.7, 0.1, 1)" : "none",
        }}
      >
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <circle cx={CX} cy={CY} r={R_OUT + 4} fill="#070c10" stroke="url(#rim)" strokeWidth="3" />
          <defs>
            <linearGradient id="rim" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#00F0FF" />
              <stop offset="100%" stopColor="#FF2BD6" />
            </linearGradient>
          </defs>
          {slices.map((s, i) => (
            <path key={i} d={s.d} fill={s.fill} stroke="rgba(0,240,255,0.3)" strokeWidth="0.6" />
          ))}
          {labels.map((l, i) => (
            <text
              key={i}
              x={l.x}
              y={l.y}
              fill="#fff"
              fontSize="9"
              fontWeight="700"
              textAnchor="middle"
              dominantBaseline="middle"
              transform={`rotate(${l.rot} ${l.x} ${l.y})`}
            >
              {l.n}
            </text>
          ))}
          <circle cx={CX} cy={CY} r={R_IN} fill="#070c10" stroke="url(#rim)" strokeWidth="2" />
        </svg>
      </div>

      {/* Repère + bille (fixes) */}
      <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 border-x-[9px] border-t-[14px] border-x-transparent border-t-amber-hi drop-shadow-[0_0_6px_rgba(0,240,255,0.7)]" />
      <div className="pointer-events-none absolute left-1/2 top-[14px] h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-white shadow-[0_0_10px_#fff]" />

      {/* Résultat au centre */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span
          className="stat text-3xl font-black"
          style={{ color: centerColor(result) }}
        >
          {result ?? "–"}
        </span>
      </div>
    </div>
  );
}
