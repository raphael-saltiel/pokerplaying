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
        <h2 className="mb-3 font-display text-xl text-gold">Configuration requise</h2>
        <p className="mb-2 text-white/80">
          Les variables d&apos;environnement Supabase ne sont pas renseignées. Ajoute
          dans <code className="text-gold">.env.local</code> (ou sur Vercel) :
        </p>
        <pre className="overflow-x-auto rounded bg-black/50 p-3 text-xs text-white/80">
{`NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...`}
        </pre>
        <p className="mt-3 text-white/60">
          Détails complets dans le <code className="text-gold">README.md</code>.
        </p>
      </div>
    );
  }

  if (loading) {
    return <div className="mt-20 text-center text-white/60">Chargement…</div>;
  }

  if (!player) {
    return (
      <div className="mx-auto mt-16 max-w-sm card-surface p-6">
        <h2 className="mb-1 font-display text-2xl text-gold">Bienvenue</h2>
        <p className="mb-4 text-sm text-white/70">
          Choisis un pseudo pour rejoindre la table. Tu commences avec{" "}
          <span className="font-semibold text-gold">10 000 jetons</span>.
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
            {busy ? "…" : "Entrer dans le casino"}
          </button>
        </form>
      </div>
    );
  }

  return <>{children}</>;
}
