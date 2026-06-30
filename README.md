# ♠ Casino Royale ♦

Un **casino multijoueur en temps réel** pour jouer entre collègues avec de l'argent
fictif. Chaque joueur démarre avec **10 000 jetons**.

- ♠ **Poker Texas Hold'em** No-Limit — jusqu'à 6 joueurs, blindes, mises, tapis, side pots, abattage, démarrage automatique
- 🎡 **Roulette** européenne — misez tous ensemble sur une roue partagée animée
- 🃏 **Blackjack** — jusqu'à 5 joueurs à la même table contre le croupier
- 🎰 **Machine à sous** — un jeu solo en bonus

Tous les jeux multijoueurs se lancent et s'enchaînent **automatiquement** (minuteurs).

Stack : **Next.js 14** (App Router) + **Supabase** (Postgres + temps réel) +
**Tailwind CSS**. Conçu pour être déployé sur **Vercel**.

Le temps réel passe par les WebSockets de Supabase (le navigateur se connecte
directement à Supabase), ce qui fonctionne parfaitement avec l'hébergement
serverless de Vercel. **Toute la logique de jeu et les soldes sont gérés côté
serveur** : les clients ne peuvent pas tricher (le sabot de cartes du blackjack
n'est jamais envoyé au navigateur).

---

## 🚀 Mise en route (environ 5 minutes)

### 1. Créer un projet Supabase (gratuit)

1. Va sur [supabase.com](https://supabase.com) → **New project**.
2. Choisis un nom, un mot de passe de base de données, une région proche.
3. Attends que le projet soit prêt (~1 min).

### 2. Créer les tables

1. Dans Supabase, ouvre **SQL Editor** → **New query**.
2. Copie-colle tout le contenu de [`supabase/schema.sql`](supabase/schema.sql).
3. Clique **Run**. (Crée les tables, la sécurité, et active le temps réel.)

### 3. Récupérer les clés

Dans Supabase : **Project Settings → API**. Note :

| Variable                          | Où la trouver                         |
| --------------------------------- | ------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`        | *Project URL*                         |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`   | *Project API keys → `anon` `public`*  |
| `SUPABASE_SERVICE_ROLE_KEY`       | *Project API keys → `service_role`* ⚠️ secret |

> ⚠️ La clé `service_role` est **secrète**. Ne la mets jamais dans du code
> public ni dans une variable `NEXT_PUBLIC_*`.

### 4. Déployer sur Vercel

1. Pousse ce dépôt sur GitHub (déjà fait si tu lis ceci sur GitHub).
2. Sur [vercel.com](https://vercel.com) → **Add New… → Project** → importe le dépôt.
3. Dans **Environment Variables**, ajoute les 3 variables ci-dessus.
4. Clique **Deploy**. 🎉

Partage ensuite l'URL Vercel à tes collègues. Chacun choisit un pseudo, puis
l'un de vous crée une table et partage le **code à 4 lettres** ; les autres le
saisissent pour rejoindre la partie.

---

## 🧑‍💻 Développement local

```bash
# 1. Installer les dépendances
npm install

# 2. Configurer l'environnement
cp .env.example .env.local
#   puis édite .env.local avec tes clés Supabase

# 3. Lancer
npm run dev
# → http://localhost:3000
```

Pour tester le multijoueur en local, ouvre plusieurs onglets (ou fenêtres de
navigation privée) avec des pseudos différents.

---

## 🎮 Règles appliquées

**Roulette (européenne, un seul zéro)**

| Mise               | Gain   |
| ------------------ | ------ |
| Numéro plein       | 35 : 1 |
| Douzaine / Colonne | 2 : 1  |
| Rouge/Noir, Pair/Impair, Manque/Passe | 1 : 1 |

N'importe quel joueur peut lancer la roue une fois les mises placées.

**Blackjack**

- Le croupier tire jusqu'à 17 (reste sur tout 17).
- Le blackjack (As + figure) paie **3 : 2**.
- Actions : **Tirer**, **Rester**, **Doubler** (le split n'est pas géré).
- Chaque joueur joue son tour ; le tour actif est mis en évidence.

**Machine à sous**

- 3 symboles identiques = jackpot (💎 ×100, 7️⃣ ×40, ⭐ ×20, 🔔 ×12, 🍋 ×8, 🍒 ×5).
- Deux 🍒 = mise ×2 ; une 🍒 = mise rendue.

---

## 🏗️ Architecture

```
src/
  app/
    page.tsx                  # Lobby (créer/rejoindre, machine à sous)
    table/[code]/page.tsx     # Salon de jeu + temps réel
    api/                      # Logique serveur (autorité sur l'état & les soldes)
      player/  table/  roulette/  blackjack/  slots/
  components/                 # UI (tables, cartes, contexte joueur…)
  lib/
    games/                    # Moteurs purs : cards, roulette, blackjack
    gameStore.ts              # Accès BDD : concurrence optimiste, soldes atomiques
    supabaseAdmin.ts          # Client serveur (service_role)
    supabaseClient.ts         # Client navigateur (anon, lecture seule)
supabase/schema.sql           # À exécuter une fois dans Supabase
```

**Intégrité des données**

- Les écritures passent toutes par l'API serveur (clé `service_role`). Les
  clients (clé `anon`) sont en **lecture seule** (RLS).
- Les soldes sont modifiés via une fonction Postgres atomique (`adjust_balance`)
  qui refuse de descendre sous zéro.
- L'état des tables utilise une **concurrence optimiste** (`version`) pour que
  des mises simultanées ne s'écrasent pas.
- Le sabot du blackjack vit dans `table_secrets`, **inaccessible aux clients**.

> 💡 Argent fictif uniquement. Aucune transaction réelle n'est possible.
