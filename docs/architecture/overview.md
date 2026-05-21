# OpenGate — Architecture Overview

## Vue d’ensemble

OpenGate est une passerelle AI locale, compatible OpenAI, qui centralise les providers et expose des experts configurables via des route profiles URL-scoped.

```text
Client (Zoo, Roo, curl)
  |
  | POST /c/{profile}/v1/chat/completions
  v
Hono Server
  ├── Routing Layer : résout le profile, l’expert, les keywords
  ├── Provider Adapter : static | proxy | oauth (futur)
  ├── SQLite DB : config, logs, routing events
  └── React UI : dashboard, graph, playground
```

## Packages

| Package | Rôle |
|---|---|
| `@opengate/shared` | Schémas Zod, types, contrats |
| `@opengate/db` | Connexion SQLite, migrations, seeds |
| `@opengate/providers` | Adapters `static`, `proxy`, OAuth (futur) |
| `@opengate/routing` | Logique de résolution expert/keyword/override |
| `@opengate/core` | Logique métier future (policies, etc.) |
| `@opengate/sdk` | SDK externe (futur) |
| `@opengate/server` | Serveur Hono, CLI, routes |
| `@opengate/web` | UI React, ReactFlow, TanStack Query |

## Flux runtime

1. Le client appelle `/c/{profileSlug}/v1/chat/completions` avec `model=builder`.
2. Le serveur résout le route profile par slug.
3. Le serveur résout l’expert `builder` dans ce profile.
4. Le serveur détecte les keywords dans le message utilisateur.
5. Le serveur enrichit le system prompt.
6. Le serveur applique un éventuel override provider/model.
7. Le serveur appelle le provider adapter.
8. Le serveur persiste la requête et l’événement de routing.
9. Le serveur retourne la réponse OpenAI-compatible.

## Principes

- OpenAI-compatible only.
- Pas de récursion.
- SQLite = runtime source of truth.
- JSON = import/export only.
- Le client orchestre ; OpenGate route.
