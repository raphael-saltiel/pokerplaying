"use client";

// Petit moteur de confettis néon sur un canvas plein écran unique.
// Utilisable depuis n'importe quel composant client : fireConfetti().

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
  color: string;
  rot: number;
  vr: number;
}

const COLORS = ["#ffb000", "#ffd23f", "#3dff88", "#ff4d1c", "#f2e8cf"];

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let particles: Particle[] = [];
let raf = 0;

function ensure() {
  if (canvas || typeof document === "undefined") return;
  canvas = document.createElement("canvas");
  canvas.style.cssText =
    "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999";
  document.body.appendChild(canvas);
  ctx = canvas.getContext("2d");
  resize();
  window.addEventListener("resize", resize);
}

function resize() {
  if (!canvas) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function loop() {
  if (!ctx || !canvas) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles = particles.filter((p) => p.life > 0);
  for (const p of particles) {
    p.vy += 0.32; // gravité
    p.vx *= 0.99;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    p.life -= 0.011;
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 8;
    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.5);
    ctx.restore();
  }
  if (particles.length > 0) {
    raf = requestAnimationFrame(loop);
  } else {
    raf = 0;
  }
}

export function fireConfetti(opts?: { x?: number; y?: number; count?: number }) {
  if (typeof window === "undefined") return;
  ensure();
  const cx = opts?.x ?? window.innerWidth / 2;
  const cy = opts?.y ?? window.innerHeight * 0.32;
  const count = opts?.count ?? 110;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 11;
    particles.push({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 4,
      life: 1,
      size: 5 + Math.random() * 6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
    });
  }
  if (!raf) raf = requestAnimationFrame(loop);
}
