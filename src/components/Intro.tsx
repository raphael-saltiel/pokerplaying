"use client";

import { useEffect, useState } from "react";

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
      <div className="intro-title">
        <span className="glitch" data-text="CASINO ROYALE">
          CASINO ROYALE
        </span>
      </div>
      <div className="intro-bar">
        <span />
      </div>
      <div className="intro-sub">// INITIALISATION DU SYSTÈME…</div>
    </div>
  );
}
