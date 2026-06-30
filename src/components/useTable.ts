"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { TableRow } from "@/lib/types";

interface State {
  table: TableRow | null;
  loading: boolean;
  error: string | null;
}

/** Charge une table et s'abonne à ses mises à jour temps réel. */
export function useTable(code: string): State {
  const [state, setState] = useState<State>({
    table: null,
    loading: true,
    error: null,
  });
  const versionRef = useRef(-1);

  useEffect(() => {
    let active = true;

    async function init() {
      try {
        const res = await fetch(`/api/table?code=${code}`);
        if (!active) return;
        if (!res.ok) {
          setState({ table: null, loading: false, error: "Table introuvable." });
          return;
        }
        const data = await res.json();
        versionRef.current = data.version ?? 0;
        setState({ table: data, loading: false, error: null });
      } catch {
        if (active) setState({ table: null, loading: false, error: "Réseau indisponible." });
      }
    }
    init();

    const channel = supabase
      .channel(`table-${code}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tables", filter: `code=eq.${code}` },
        (payload) => {
          const row = payload.new as any;
          if (!row || row.code !== code) return;
          // ignore les mises à jour plus anciennes (ordre réseau)
          if (typeof row.version === "number" && row.version < versionRef.current) return;
          versionRef.current = row.version ?? versionRef.current;
          setState((s) => ({
            table: {
              code: row.code,
              game: row.game,
              state: row.state,
              host_id: row.host_id,
              updated_at: row.updated_at,
            },
            loading: false,
            error: s.error && row ? null : s.error,
          }));
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [code]);

  return state;
}
