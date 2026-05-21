# Rapport d’extraction d’archive — OpenGate

> Date : 2026-05-21
> Source primaire : [`docs/OpenGate_BIBLE_ROUTE_PROFILE_URL_REWRITE_FINAL.md`](../../docs/OpenGate_BIBLE_ROUTE_PROFILE_URL_REWRITE_FINAL.md)
> Archives inspectées : `archive/OpenGate-archive/`, `archive/claude-code-proxy-main/`, `archive/claude-code-proxy-gemini/`

---

## 1. Ce qui est réutilisable

### 1.1 Schémas OpenAI legacy

Le fichier [`archive/OpenGate-archive/src/openai/schema.ts`](../../archive/OpenGate-archive/src/openai/schema.ts) contient des types TypeScript pour :
- `OpenAIChatCompletionRequest`
- `OpenAIChatCompletionChunk`
- `OpenAIMessage`
- `OpenAIModel`

**Verdict** : les noms de champs et la structure sont corrects et peuvent servir de base aux schémas Zod du nouveau projet.

### 1.2 Adaptateur Proxy provider

Le fichier [`archive/OpenGate-archive/src/providers/proxy/index.ts`](../../archive/OpenGate-archive/src/providers/proxy/index.ts) implémente un provider `proxy` qui appelle un endpoint OpenAI-compatible distant (`baseUrl`).

**Verdict** : le principe (forward de la requête, gestion du stream SSE, mapping des modèles) est directement transposable. La nouvelle implémentation utilisera l’interface `ProviderAdapter` propre (Hono `Request`/`Response` ou fetch standard).

### 1.3 Authentification OAuth — Codex

Les fichiers suivants décrivent le flux OAuth device-code + browser pour ChatGPT/Codex :
- [`archive/OpenGate-archive/src/providers/codex/auth/device.ts`](../../archive/OpenGate-archive/src/providers/codex/auth/device.ts)
- [`archive/OpenGate-archive/src/providers/codex/auth/manager.ts`](../../archive/OpenGate-archive/src/providers/codex/auth/manager.ts)
- [`archive/OpenGate-archive/src/providers/codex/auth/token-store.ts`](../../archive/OpenGate-archive/src/providers/codex/auth/token-store.ts)
- [`archive/OpenGate-archive/src/providers/codex/auth/jwt.ts`](../../archive/OpenGate-archive/src/providers/codex/auth/jwt.ts)
- [`archive/OpenGate-archive/src/providers/codex/auth/pkce.ts`](../../archive/OpenGate-archive/src/providers/codex/auth/pkce.ts)

**Verdict** : les constantes d’URL, la logique PKCE, le stockage de token et la rotation JWT sont réutilisables comme **spécifications comportementales**. Le code doit être réécrit dans le nouveau package `providers` avec des interfaces propres et sans dépendance à `Bun.*` dans le cœur.

### 1.4 Authentification OAuth — Kimi

Les fichiers suivants décrivent le flux Kimi (device-id, headers spécifiques, signature) :
- [`archive/OpenGate-archive/src/providers/kimi/auth/login.ts`](../../archive/OpenGate-archive/src/providers/kimi/auth/login.ts)
- [`archive/OpenGate-archive/src/providers/kimi/auth/manager.ts`](../../archive/OpenGate-archive/src/providers/kimi/auth/manager.ts)
- [`archive/OpenGate-archive/src/providers/kimi/auth/headers.ts`](../../archive/OpenGate-archive/src/providers/kimi/auth/headers.ts)
- [`archive/OpenGate-archive/src/providers/kimi/auth/signature.ts`](../../archive/OpenGate-archive/src/providers/kimi/auth/signature.ts)

**Verdict** : même conclusion que Codex. Le comportement (login, refresh, signature HMAC, user-agent custom) est documenté et servira de base à l’implémentation future.

### 1.5 Authentification OAuth — Gemini (PR non fusionnée)

La branche `claude-code-proxy-gemini` contient :
- [`archive/claude-code-proxy-gemini/src/providers/gemini/auth/oauth.ts`](../../archive/claude-code-proxy-gemini/src/providers/gemini/auth/oauth.ts)
- [`archive/claude-code-proxy-gemini/src/providers/gemini/translate/request.ts`](../../archive/claude-code-proxy-gemini/src/providers/gemini/translate/request.ts)
- [`archive/claude-code-proxy-gemini/src/providers/gemini/translate/stream.ts`](../../archive/claude-code-proxy-gemini/src/providers/gemini/translate/stream.ts)

**Verdict** : c’est une PR externe non fusionnée. Le code est une **preuve de concept** utile pour comprendre les quirks de l’API Gemini (modèles, streaming, signatures). Il ne doit pas être copié tel quel.

### 1.6 Gestion des chemins et configuration

- [`archive/OpenGate-archive/src/paths.ts`](../../archive/OpenGate-archive/src/paths.ts) : logique de répertoire de config multiplateforme (macOS/Linux/Windows).
- [`archive/OpenGate-archive/src/config.ts`](../../archive/OpenGate-archive/src/config.ts) : lecture de `config.json`, variables d’environnement, fallback.

**Verdict** : la logique de résolution de chemins (`%APPDATA%`, `~/.config`, etc.) est réutilisable. La gestion de la configuration JSON legacy est **rejetée** au profit de SQLite.

---

## 2. Ce qui est rejeté

| Élément legacy | Raison du rejet |
|---|---|
| `Bun.serve` direct | Le nouveau projet utilise Hono + Web API standard pour rester compatible Node LTS. |
| `config.json` comme source de vérité runtime | La spec impose SQLite. JSON devient import/export uniquement. |
| Endpoints Anthropic `/v1/messages` | Le projet est **OpenAI-compatible only**. L’ancien bridge Anthropic est retiré. |
| Profils globaux JSON (`profiles` dans `config.json`) | Les profils deviennent des **route profiles** stockés en SQLite, accessibles par URL. |
| `Provider` legacy (interface double protocole OpenAI + Anthropic) | Remplacé par `ProviderAdapter` unique avec `protocol: "openai"`. |
| Sessions en mémoire (`Map<string, SessionState>`) | La sessionnality et l’affinité provider ne sont pas dans le périmètre v1. |
| `sse.ts` maison | Hono gère nativement le streaming et les réponses SSE. |

---

## 3. Principes de migration du code

1. **Ne pas importer** de modules depuis `archive/` dans le nouveau code.
2. **Lire** l’archive pour comprendre les headers, URLs, et séquences d’authentification.
3. **Réécrire** chaque provider derrière l’interface `ProviderAdapter` propre.
4. **Extraire** les constantes (URLs OAuth, scopes, user-agents) dans des fichiers de configuration déclarative.
5. **Tester** chaque provider réécrit indépendamment avec un provider `static` de test.

---

## 4. Liste des comportements à réimplémenter (post-MVP)

- [ ] OAuth Codex : device flow, token store, refresh, header `X-Codex-Originator`
- [ ] OAuth Kimi : login web, device-id, signature, headers custom
- [ ] OAuth Gemini : OAuth 2.0 web, discovery modèles, adaptation streaming
- [ ] Proxy provider : découverte modèles (`GET /v1/models`), forwarding requête, gestion streaming
- [ ] `keychain.ts` : stockage sécurisé des tokens sur macOS/Windows/Linux (différé après auth)
