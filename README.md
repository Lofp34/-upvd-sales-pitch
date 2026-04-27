# UPVD Sales Pitch

Application atelier concentree sur la redaction du pitch pour les startupers UPVD. Chaque participant rejoint une session, travaille sa valeur ajoutee, redige son pitch 30 secondes et sa version 1 minute, puis peut dicter ses idees a la voix avant de les retravailler avec l'IA.

## Stack

- Next.js 16 App Router
- TypeScript
- Tailwind CSS 4 + shadcn/ui
- Neon Postgres via Vercel Marketplace
- Drizzle ORM
- OpenAI Responses API avec `gpt-5.4`
- OpenAI Audio Transcriptions avec `gpt-4o-mini-transcribe`

## Parcours produit

- `/coach`
  Espace formateur pour ouvrir une session, recuperer le lien participant,
  consulter les productions et envoyer des conseils instantanes.
- `/s/[slug]`
  Entree participant avec `nom + startup`.
- `/s/[slug]/atelier`
  Studio pitch mono-ecran, autosave, rail de coaching, dictée vocale et boutons IA explicites.
- `/r/[token]`
  Lien personnel de reprise.

## Variables d'environnement

Copier `.env.example` vers `.env.local` pour le local.

```bash
DATABASE_URL=
OPENAI_API_KEY=
COACH_ACCESS_CODE=
SESSION_COOKIE_SECRET=
```

Notes:

- `DATABASE_URL` peut venir directement de Neon ou etre remappee depuis une variable injectee par Vercel Marketplace.
- `OPENAI_API_KEY` reste strictement cote serveur.
- `COACH_ACCESS_CODE` protege l'entree formateur.
- `SESSION_COOKIE_SECRET` sert a signer le cookie coach.
- Cette application est prevue pour reutiliser la meme base Neon que l'application atelier complete, mais avec des tables dediees: `pitch_sessions`, `pitch_workbooks` et `pitch_coach_messages`.

## Demarrage local

```bash
npm install
npm run dev
```

Application disponible sur [http://localhost:3000](http://localhost:3000).

## Base de donnees

Le schema Drizzle est dans `src/lib/db/schema.ts`.

Commandes utiles:

```bash
npm run db:generate
npm run db:push
npm run db:studio
```

Pour le MVP, `db:push` suffit en general.

## IA texte

Un seul endpoint applicatif est expose:

- `POST /api/ai/assist`

Actions autorisees:

- `clarify`
- `shorten`
- `variants_3`
- `flag_vagueness`
- `oralize_30s`
- `oralize_60s`

Contraintes serveur:

- reponse en francais
- aucune invention
- ne pas completer les blancs
- signaler ce qui manque
- posture de coach, pas de redacteur a la place du participant

## IA voix

Endpoint ajoute:

- `POST /api/audio/transcribe`

Choix techniques:

- mode batch fichier web
- `gpt-4o-mini-transcribe`
- `language=fr`
- garde-fou taille < 24 MB
- dictée limitee a 5 minutes par prise
- insertion du texte transcrit dans le champ cible

Prevalidation du payload audio:

```bash
python3 /Users/laurents/Desktop/ai-skills-registry/openai-audio-transcription-gpt4o-mini/scripts/validate_transcription_stack.py \
  --mode audio \
  --payload docs/transcription-payload.example.json \
  --file-size-bytes 1800000 \
  --duration-seconds 90
```

## Deploiement Vercel

1. Importer le repo GitHub dans Vercel.
2. Ajouter une base Postgres Marketplace, idealement Neon.
3. Renseigner les 4 variables d'environnement.
4. Executer `npm run db:push` une premiere fois contre la base cible pour creer `pitch_sessions` et `pitch_workbooks`.
5. Deployer.

Le projet est pret pour un deploiement Vercel standard sans cle OpenAI cote client.

## Verification

Validation effectuee:

- `npm run lint` OK
- `npm run build` OK

Important:

- Dans le dossier local actuel, le caractere `#` present dans le chemin parent perturbe le build Next/Webpack sur macOS.
- Le code lui-meme build correctement dans un chemin neutre et doit deployer normalement sur Vercel.
