"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { supabase, supabaseConfigured } from "@/lib/supabaseClient";
import type { Player } from "@/lib/types";

interface PlayerCtx {
  player: Player | null;
  loading: boolean;
  configured: boolean;
  createPlayer: (name: string) => Promise<void>;
  refresh: () => Promise<void>;
  logout: () => void;
  setBalance: (b: number) => void;
}

const Ctx = createContext<PlayerCtx | null>(null);
const STORAGE_KEY = "casino_player_id";

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const subscribeBalance = useCallback((id: string) => {
    if (!supabaseConfigured) return;
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    const ch = supabase
      .channel(`player-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "players", filter: `id=eq.${id}` },
        (payload) => {
          const row = payload.new as Player;
          if (typeof row?.balance === "number") {
            setPlayer((p) => (p ? { ...p, balance: row.balance } : p));
          }
        }
      )
      .subscribe((status) => {
        // À chaque (re)connexion du canal, on resynchronise le solde depuis le
        // serveur pour rattraper d'éventuelles mises à jour manquées hors-ligne.
        if (status === "SUBSCRIBED") {
          fetch(`/api/player?id=${id}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
              if (data && typeof data.balance === "number") {
                setPlayer((p) => (p ? { ...p, balance: data.balance } : p));
              }
            })
            .catch(() => {});
        }
      });
    channelRef.current = ch;
  }, []);

  const refresh = useCallback(async () => {
    const id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      setPlayer(null);
      return;
    }
    try {
      const res = await fetch(`/api/player?id=${id}`);
      if (res.ok) {
        const data = (await res.json()) as Player;
        setPlayer(data);
        subscribeBalance(data.id);
      } else {
        localStorage.removeItem(STORAGE_KEY);
        setPlayer(null);
      }
    } catch {
      /* hors-ligne : on garde l'état courant */
    }
  }, [subscribeBalance]);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [refresh]);

  const createPlayer = useCallback(
    async (name: string) => {
      const res = await fetch("/api/player", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error ?? "Création impossible.");
      }
      const data = (await res.json()) as Player;
      localStorage.setItem(STORAGE_KEY, data.id);
      setPlayer(data);
      subscribeBalance(data.id);
    },
    [subscribeBalance]
  );

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    setPlayer(null);
  }, []);

  const setBalance = useCallback((b: number) => {
    setPlayer((p) => (p ? { ...p, balance: b } : p));
  }, []);

  return (
    <Ctx.Provider
      value={{
        player,
        loading,
        configured: supabaseConfigured,
        createPlayer,
        refresh,
        logout,
        setBalance,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePlayer doit être utilisé dans PlayerProvider");
  return ctx;
}
