import { createClient } from "@supabase/supabase-js";

// Client serveur avec la clé service_role : contourne la RLS.
// À n'importer QUE dans des route handlers / code serveur, jamais côté client.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  // Erreur explicite au démarrage si la config est manquante.
  console.warn(
    "[supabaseAdmin] NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant. " +
      "Renseigne tes variables d'environnement (voir .env.example)."
  );
}

// Valeurs de repli pour que le build ne casse pas quand la config est absente.
// Les routes sont `force-dynamic` : aucune requête n'est émise au build.
export const supabaseAdmin = createClient(
  url || "http://placeholder.supabase.co",
  serviceKey || "placeholder-key",
  { auth: { persistSession: false, autoRefreshToken: false } }
);
