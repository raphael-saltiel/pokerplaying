"use client";

import { createClient } from "@supabase/supabase-js";

// Client navigateur avec la clé anon : lecture seule (RLS).
// Sert à s'abonner aux changements temps réel des tables/joueurs.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// Repli pour ne pas casser le prérendu quand la config est absente.
export const supabase = createClient(
  url || "http://placeholder.supabase.co",
  anonKey || "placeholder-key",
  {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 10 } },
  }
);

export const supabaseConfigured = Boolean(url && anonKey);
