-- =====================================================================
--  Casino Royale — Schéma Supabase
--  À exécuter UNE FOIS dans : Supabase > SQL Editor > New query > Run
-- =====================================================================

-- ---------- Joueurs ----------
create table if not exists public.players (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  balance    bigint not null default 10000,
  created_at timestamptz not null default now()
);

-- ---------- Tables de jeu (salons) ----------
create table if not exists public.tables (
  code       text primary key,
  game       text not null,              -- 'roulette' | 'blackjack'
  state      jsonb not null default '{}'::jsonb,
  version    integer not null default 0, -- concurrence optimiste
  host_id    uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tables_updated_at_idx on public.tables (updated_at desc);

-- ---------- Secrets de table (sabot de cartes non distribuées) ----------
-- Stockage du paquet restant. JAMAIS lisible par les clients (aucune policy),
-- pour qu'un joueur ne puisse pas voir les cartes à venir.
create table if not exists public.table_secrets (
  code  text primary key references public.tables(code) on delete cascade,
  deck  jsonb not null default '[]'::jsonb
);

-- =====================================================================
--  Ajustement atomique de solde (évite les pertes de mise concurrentes).
--  Retourne le nouveau solde, ou NULL si fonds insuffisants.
-- =====================================================================
create or replace function public.adjust_balance(pid uuid, delta bigint)
returns bigint
language plpgsql
as $$
declare
  new_balance bigint;
begin
  update public.players
     set balance = balance + delta
   where id = pid
     and balance + delta >= 0
  returning balance into new_balance;
  return new_balance; -- NULL si aucune ligne (fonds insuffisants ou id inconnu)
end;
$$;

-- =====================================================================
--  Résolution atomique d'un tour : met à jour l'état de la table (avec
--  garde de version optimiste) ET crédite les gagnants, le tout dans une
--  seule transaction. Évite toute perte de gain si le serveur plante entre
--  le commit de l'état et le crédit des soldes.
--    p_credits : objet jsonb { "<playerId>": <montant>, ... }
--  Retourne true si le commit a eu lieu, false en cas de conflit de version.
-- =====================================================================
create or replace function public.resolve_table(
  p_code text,
  p_expected_version integer,
  p_new_state jsonb,
  p_credits jsonb
)
returns boolean
language plpgsql
as $$
declare
  rows_updated integer;
  r record;
begin
  update public.tables
     set state = p_new_state,
         version = version + 1,
         updated_at = now()
   where code = p_code
     and version = p_expected_version;
  get diagnostics rows_updated = row_count;
  if rows_updated = 0 then
    return false; -- conflit de version : un autre process a déjà résolu
  end if;

  if p_credits is not null then
    for r in select key, value from jsonb_each_text(p_credits) loop
      if r.value::bigint > 0 then
        update public.players
           set balance = balance + r.value::bigint
         where id = r.key::uuid;
      end if;
    end loop;
  end if;

  return true;
end;
$$;

-- =====================================================================
--  Row Level Security
--  Les clients (clé anon) peuvent UNIQUEMENT lire.
--  Toutes les écritures passent par l'API serveur avec la clé service_role,
--  qui contourne la RLS — la logique de jeu et les soldes restent fiables.
-- =====================================================================
alter table public.players       enable row level security;
alter table public.tables        enable row level security;
alter table public.table_secrets enable row level security;
-- table_secrets : RLS activée SANS aucune policy => clients (anon) n'y ont
-- aucun accès. Seul le serveur (service_role) la lit/écrit.

drop policy if exists "players_read" on public.players;
create policy "players_read" on public.players
  for select using (true);

drop policy if exists "tables_read" on public.tables;
create policy "tables_read" on public.tables
  for select using (true);

-- =====================================================================
--  Temps réel : diffuser les changements de ces tables aux clients
-- =====================================================================
do $$
begin
  begin
    alter publication supabase_realtime add table public.tables;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.players;
  exception when duplicate_object then null;
  end;
end $$;
