"use client";

import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";

// Intro "boot" affichée une fois par session au chargement du lobby.
export function Intro() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem("intro_seen")) return;
      sessionStorage.setItem("intro_seen", "1");
    } catch {
      /* sessionStorage indisponible : on affiche quand même */
    }
    setShow(true);
    const t = setTimeout(() => setShow(false), 2400);
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;

  return (
    <div className="intro-overlay">
      <Logo size={110} className="drop-shadow-[0_0_22px_rgba(0,240,255,0.6)]" />
      <div className="intro-title">
        <span className="glitch" data-text="DARKPOOL://">
          DARKPOOL://
        </span>
      </div>
      <div className="intro-bar">
        <span />
      </div>
      <div className="intro-sub">CERCLE PRIVÉ // OUVERTURE DE SESSION…</div>
    </div>
  );
}
