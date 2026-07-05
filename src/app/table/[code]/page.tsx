"use client";

import Link from "next/link";
import { Header } from "@/components/Header";
import { Gate } from "@/components/Gate";
import { useTable } from "@/components/useTable";
import { RouletteTable } from "@/components/RouletteTable";
import { BlackjackTable } from "@/components/BlackjackTable";
import { PokerTable } from "@/components/PokerTable";

export default function TablePage({ params }: { params: { code: string } }) {
  const upper = params.code.toUpperCase();
  return (
    <main className="min-h-screen">
      <Header />
      <Gate>
        <Room code={upper} />
      </Gate>
    </main>
  );
}

function Room({ code }: { code: string }) {
  const { table, loading, error } = useTable(code);

  if (loading) {
    return <div className="mt-20 text-center text-white/60">Chargement de la table…</div>;
  }
  if (error || !table) {
    return (
      <div className="mx-auto mt-20 max-w-sm card-surface p-6 text-center">
        <p className="mb-4 text-white/80">{error ?? "Table introuvable."}</p>
        <Link href="/" className="btn-gold">
          Retour au lobby
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-3 py-5 sm:px-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <span className="tag">TBL:// code de la table</span>
          <div className="stat font-display text-2xl font-bold tracking-widest text-amber">
            {code}
          </div>
        </div>
        <ShareButton code={code} />
      </div>
      {table.game === "roulette" ? (
        <RouletteTable code={code} state={table.state as any} />
      ) : table.game === "poker" ? (
        <PokerTable code={code} state={table.state as any} />
      ) : (
        <BlackjackTable code={code} state={table.state as any} />
      )}
    </div>
  );
}

function ShareButton({ code }: { code: string }) {
  async function share() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const text = `Rejoins ma table de casino — code ${code} : ${url}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "DARKPOOL://", text, url });
      } else {
        await navigator.clipboard.writeText(url);
        alert("Lien copié !");
      }
    } catch {
      /* annulé */
    }
  }
  return (
    <button onClick={share} className="btn-dark text-sm">
      📤 Inviter
    </button>
  );
}
