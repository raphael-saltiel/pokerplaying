import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { Card, Player } from "@/lib/types";

export interface LoadedTable {
  code: string;
  game: "roulette" | "blackjack";
  state: any;
  version: number;
  host_id: string | null;
}

export async function loadTable(code: string): Promise<LoadedTable | null> {
  const { data, error } = await supabaseAdmin
    .from("tables")
    .select("code, game, state, version, host_id")
    .eq("code", code)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return data as LoadedTable;
}

/**
 * Écrit le nouvel état UNIQUEMENT si la version n'a pas changé (concurrence
 * optimiste). Renvoie true si le commit a réussi, false s'il faut réessayer.
 */
export async function commitTable(
  code: string,
  expectedVersion: number,
  newState: any
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("tables")
    .update({
      state: newState,
      version: expectedVersion + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("code", code)
    .eq("version", expectedVersion)
    .select("code");
  if (error) throw new Error(error.message);
  return Array.isArray(data) && data.length === 1;
}

/**
 * Commit de l'état ET crédit des gagnants dans UNE SEULE transaction Postgres
 * (garde de version optimiste incluse). Renvoie true si le commit a eu lieu.
 * Garantit qu'aucun gain n'est perdu si le serveur plante entre les deux.
 */
export async function resolveTable(
  code: string,
  expectedVersion: number,
  newState: any,
  credits: Record<string, number>
): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc("resolve_table", {
    p_code: code,
    p_expected_version: expectedVersion,
    p_new_state: newState,
    p_credits: credits ?? {},
  });
  if (error) throw new Error(error.message);
  return data === true;
}

/**
 * Boucle "lire → muter → commit" avec réessais en cas de conflit de version.
 * `mutator` reçoit l'état courant et renvoie le nouvel état (ou null pour annuler).
 * Si la mutation renvoie `credits`, l'état et les soldes sont validés ensemble,
 * de façon atomique (via resolve_table).
 */
export async function withTable<T = void>(
  code: string,
  mutator: (
    table: LoadedTable
  ) =>
    | Promise<{ state: any; result?: T; credits?: Record<string, number> } | null>
    | { state: any; result?: T; credits?: Record<string, number> }
    | null,
  attempts = 6
): Promise<{ ok: boolean; result?: T; reason?: string }> {
  for (let i = 0; i < attempts; i++) {
    const table = await loadTable(code);
    if (!table) return { ok: false, reason: "Table introuvable." };
    const mutation = await mutator(table);
    if (mutation === null) return { ok: false, reason: "rejected" };
    const committed = mutation.credits
      ? await resolveTable(code, table.version, mutation.state, mutation.credits)
      : await commitTable(code, table.version, mutation.state);
    if (committed) return { ok: true, result: mutation.result };
    // sinon : conflit de version, on relit et on réessaie
  }
  return { ok: false, reason: "Conflit de concurrence, réessaie." };
}

export async function adjustBalance(
  playerId: string,
  delta: number
): Promise<number | null> {
  const { data, error } = await supabaseAdmin.rpc("adjust_balance", {
    pid: playerId,
    delta,
  });
  if (error) throw new Error(error.message);
  return (data as number | null) ?? null;
}

export async function getPlayer(id: string): Promise<Player | null> {
  const { data, error } = await supabaseAdmin
    .from("players")
    .select("id, name, balance")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Player) ?? null;
}

// ---------------- Sabot secret (blackjack) ----------------

/**
 * Orchestration d'une action blackjack : lit table + sabot, applique l'action,
 * commit l'état (garde de version), puis persiste le sabot et crédite les gains.
 * `action` renvoie { state, deck, credits? } ou null pour rejeter.
 */
export async function withBlackjack(
  code: string,
  action: (
    state: any,
    deck: Card[]
  ) => { state: any; deck: Card[]; credits?: Record<string, number> } | null,
  attempts = 6
): Promise<{ ok: boolean; reason?: string }> {
  for (let i = 0; i < attempts; i++) {
    const table = await loadTable(code);
    if (!table) return { ok: false, reason: "Table introuvable." };
    const deck = await loadDeck(code);
    const out = action(table.state, deck);
    if (out === null) return { ok: false, reason: "rejected" };
    // Si gains à verser : état + soldes validés atomiquement (resolve_table).
    const committed = out.credits
      ? await resolveTable(code, table.version, out.state, out.credits)
      : await commitTable(code, table.version, out.state);
    if (committed) {
      // Le sabot (table séparée) est persisté après coup : en cas d'échec ici,
      // aucun jeton n'est perdu (seul le paquet pourrait différer, re-mélangé
      // au prochain tour). On l'isole pour ne jamais bloquer un crédit déjà fait.
      try {
        await saveDeck(code, out.deck);
      } catch (e) {
        console.error("[withBlackjack] saveDeck a échoué après commit:", e);
      }
      return { ok: true };
    }
    // conflit de version -> on relit tout et on réessaie
  }
  return { ok: false, reason: "Conflit de concurrence, réessaie." };
}

export async function loadDeck(code: string): Promise<Card[]> {
  const { data, error } = await supabaseAdmin
    .from("table_secrets")
    .select("deck")
    .eq("code", code)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return ((data?.deck as Card[]) ?? []) as Card[];
}

export async function saveDeck(code: string, deck: Card[]): Promise<void> {
  const { error } = await supabaseAdmin
    .from("table_secrets")
    .upsert({ code, deck });
  if (error) throw new Error(error.message);
}
