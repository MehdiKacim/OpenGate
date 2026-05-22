# OpenGate — Runtime Flow

## Séquence : `POST /c/opengate-dev/v1/chat/completions`

```text
Client
  |
  v
[1] Hono reçoit la requête
  |
  v
[2] Extraction de profileSlug = "opengate-dev"
  |
  v
[3] SELECT route_profiles WHERE slug = "opengate-dev"
  |
  v
[4] Extraction de model = "builder"
  |
  v
[5] INSERT INTO requests (id, route_profile_id, requested_model, status="pending")
  |
  v
[6] resolveRouting(db, profileId, "builder", userMessageText)
      ├── SELECT expert WHERE name="builder" AND enabled=1
      ├── SELECT keywords WHERE expert_id=… AND enabled=1
      ├── Détection textuelle des keywords
      └── SELECT override WHERE keyword IN (…) ORDER BY priority
  |
  v
[7] INSERT INTO routing_events (request_id, expert_name, detected_keywords, …)
  |
  v
[8] Construction de la requête OpenAI
      ├── system prompt enrichi
      ├── messages client
      ├── temperature / max_tokens
      └── stream flag
  |
  v
[9] Appel du provider adapter (static | proxy | oauth)
  |
  v
[10] UPDATE requests SET status="completed", latency_ms=…, final_provider_id=…
  |
  v
[11] Réponse OpenAI-compatible retournée au client
```

## Règles de sécurité

- Pas de récursion : un expert ne peut pas déclencher un autre expert.
- Pas de mutation de config pendant une requête.
- Les tokens de coût sont passifs (observabilité seulement).
