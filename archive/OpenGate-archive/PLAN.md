# OpenGate — Plan de développement

## ✅ Terminé

### Renommage complet (claude-code-proxy → OpenGate)
- [x] Package `package.json` : nom `opengate`, binaire `opengate`
- [x] CLI `src/cli.ts` : messages version, usage, exemples rebranding
- [x] Scripts `scripts/install.sh` : variables `OPENGATE_*`, repo `raine/opengate`
- [x] Release workflow `.github/workflows/release.yml` : binaire, archives, formula Homebrew `opengate.rb`
- [x] Répertoires config/state `src/paths.ts` : migrés vers `opengate`, fallback legacy conservé
- [x] Messages d'erreur config `src/config.ts` : rebrandés
- [x] OAuth Codex : originator et User-Agent rebrandés
- [x] Keychain macOS : services renommés `opengate.codex` / `opengate.kimi`
- [x] Messages d'auth CLI : `opengate <provider> auth login`
- [x] Signature interne Kimi : préfixe `opengate:kimi:v1`
- [x] Tests : préfixes dossiers temporaires et assertions alignées
- [x] CHANGELOG : historique mis à jour avec liens repo
- [x] Recherche globale : **zéro occurrence restante** de `claude-code-proxy` / `ccp` / `Claude Code Proxy` hors compatibilité volontaire

### Architecture nouvelle
- [x] Schémas OpenAI `src/openai/schema.ts` : `OpenAIChatCompletionRequest`, `OpenAIChatCompletionChunk`, `OpenAIMessage`, `OpenAIModel`, etc.
- [x] Adaptateur OpenAI↔Anthropic `src/openai/adapter.ts` : `openAIToAnthropic()`, `anthropicToOpenAI()`, `anthropicChunkToOpenAI()`
- [x] Bridge legacy `src/openai/legacy-bridge.ts` : `legacyAdapterComplete()` pour appeler des providers Anthropic depuis des requêtes OpenAI
- [x] Types `src/providers/types.ts` : `ProviderAdapter` avec `protocol`, `listModels()`, `complete()`, `usage?()` + `Provider` legacy conservé
- [x] Provider proxy `src/providers/proxy/index.ts` : `createProxyProvider()` pour Ollama/LM Studio/OVMS
- [x] Registry `src/providers/registry.ts` : `buildAdapters()`, `getAdapter()`, `adapterForModel()`, `allAdapters()`, support chargement dynamique providers proxy depuis config
- [x] Profils `src/profiles.ts` : `resolveProfile()`, `listProfiles()` avec profiles builtin (`architect`, `builder`, `commit-writer`) + support config.json
- [x] Config `src/config.ts` : ajout `ProfileConfig` et `profiles` dans `FileConfig`
- [x] Serveur `src/server.ts` :
  - [x] `GET /v1/models` — liste tous les modèles supportés
  - [x] `POST /v1/chat/completions` — endpoint OpenAI avec routing par modèle ou profil
  - [x] `GET /_opengate/usage` — agrégation usage tous providers
  - [x] `GET /_opengate/providers/{name}/usage` — usage par provider
  - [x] Préservation endpoints Anthropic legacy (`/v1/messages`, `/v1/messages/count_tokens`)
- [x] CLI `src/cli.ts` : commande `opengate profiles`, affichage endpoints et profiles au démarrage
- [x] README.md : documentation complète

---

## ❌ Reste à faire / À valider

### 1. Tests
- [ ] **Exécuter la suite de tests** : `bun test` n'est pas disponible sur ce poste (Windows, bun non installé)
- [ ] Corriger les éventuelles erreurs TypeScript/runtime découvertes par les tests
- [ ] Ajouter des tests pour les nouveaux endpoints OpenAI (`/v1/models`, `/v1/chat/completions`)
- [ ] Ajouter des tests pour le système de profils
- [ ] Ajouter des tests pour le provider proxy

### 2. Compilation / TypeScript
- [ ] Vérifier `tsc --noEmit` passe sans erreur (les types Bun/DOM peuvent nécessiter un ajustement de `tsconfig.json`)
- [ ] Vérifier que `src/openai/legacy-bridge.ts` gère correctement tous les types d'événements SSE Anthropic

### 3. Usage tracking (implémentation partielle)
- [ ] Le endpoint `/_opengate/usage` existe mais les providers legacy (codex/kimi) n'implémentent pas encore `usage()`
- [ ] Implémenter `usage()` sur les adapters legacy si besoin, ou retourner une valeur par défaut

### 4. Améliorations
- [ ] Compacter les logs comme demandé dans le system prompt (actuellement JSON structuré, pas d'Ink UI)
- [ ] Ajouter endpoint optionnel `POST /v1/responses` (OpenAI Responses API)
- [ ] Support Gemini (futur)
- [ ] Validation TLS par provider (`allowInvalidCertificates` déjà dans config et proxy)

### 5. Release
- [ ] Mettre à jour la version dans `package.json`
- [ ] Mettre à jour `CHANGELOG.md` avec les nouvelles fonctionnalités
- [ ] Tester l'install script
- [ ] Tester la release workflow

---

## Fichiers créés/modifiés clés

| Fichier | Statut |
|---------|--------|
| `package.json` | ✅ Renommé |
| `src/cli.ts` | ✅ Rebrandé + nouvelles commandes |
| `src/config.ts` | ✅ + `profiles` config |
| `src/paths.ts` | ✅ Répertoires `opengate` |
| `src/server.ts` | ✅ + endpoints OpenAI + usage + profils |
| `src/profiles.ts` | ✅ Nouveau |
| `src/providers/types.ts` | ✅ `ProviderAdapter` |
| `src/providers/registry.ts` | ✅ Adapters + proxy dynamique |
| `src/providers/proxy/index.ts` | ✅ Nouveau |
| `src/openai/schema.ts` | ✅ Nouveau |
| `src/openai/adapter.ts` | ✅ Nouveau |
| `src/openai/legacy-bridge.ts` | ✅ Nouveau |
| `scripts/install.sh` | ✅ Rebrandé |
| `.github/workflows/release.yml` | ✅ Rebrandé |
| `README.md` | ✅ Réécrit |
| `CHANGELOG.md` | ✅ Mis à jour |

---

## Prochaine action recommandée

1. **Commit** l'état actuel : `git add -A && git commit -m "wip: rebrand to OpenGate + OpenAI endpoints + profiles + proxy providers"`
2. Sur l'autre poste : `bun install && bun test`
3. Corriger les erreurs remontées
4. Itérer jusqu'à tests verts
