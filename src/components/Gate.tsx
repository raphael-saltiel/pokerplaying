"use client";

import { useState } from "react";
import { usePlayer } from "@/components/PlayerProvider";

export function Gate({ children }: { children: React.ReactNode }) {
  const { player, loading, configured, createPlayer } = usePlayer();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!configured) {
    return (
      <div className="mx-auto mt-16 max-w-lg card-surface p-6 text-sm leading-relaxed">
        <span className="tag mb-2 inline-block">SYS:// ERREUR CONFIG</span>
        <h2 className="mb-3 font-display text-xl text-amber">Configuration requise</h2>
        <p className="mb-2 text-white/80">
          Les variables d&apos;environnement Supabase ne sont pas renseignées. Ajoute
          dans <code className="bg-carbon-800 px-1 text-amber">.env.local</code> (ou sur Vercel) :
        </p>
        <pre className="overflow-x-auto border border-amber/20 bg-carbon-800 p-3 text-xs text-amber">
{`NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...`}
        </pre>
        <p className="mt-3 text-white/60">
          Détails complets dans le <code className="bg-carbon-800 px-1 text-amber">README.md</code>.
        </p>
      </div>
    );
  }

  if (loading) {
    return <div className="mt-20 text-center text-white/60">// chargement…</div>;
  }

  if (!player) {
    return (
      <div className="mx-auto mt-16 max-w-sm card-surface p-6">
        <span className="tag mb-2 inline-flex items-center gap-2">
          <span className="live-dot" /> DARKPOOL:// IDENTIFICATION
        </span>
        <h2 className="mb-1 font-display text-2xl text-amber">ENTRER DANS LE CERCLE</h2>
        <p className="mb-4 text-sm text-white/70">
          Choisis un pseudo pour rejoindre le cercle. Compte crédité de{" "}
          <span className="stat text-cash">10 000 jetons</span>. Zéro argent réel.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;
            setBusy(true);
            setErr(null);
            try {
              await createPlayer(name.trim());
            } catch (e: any) {
              setErr(e.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            placeholder="Ton pseudo"
            className="chip-input mb-3 w-full"
          />
          {err && <p className="mb-3 text-sm text-red-400">{err}</p>}
          <button type="submit" disabled={busy || !name.trim()} className="btn-gold w-full">
            {busy ? "…" : "Entrer dans le cercle"}
          </button>
        </form>
      </div>
    );
  }

  return <>{children}</>;
}
