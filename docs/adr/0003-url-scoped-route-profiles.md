# ADR 0003 : URL-scoped route profiles

## Contexte

La sélection de configuration doit être explicite et portable. Les clients ne supportent pas tous les headers custom.

## Décision

La configuration est sélectionnée via l’URL :

```
/c/{profileSlug}/v1/models
/c/{profileSlug}/v1/chat/completions
```

Un alias `/v1/*` optionnel peut pointer vers un profil par défaut explicitement configuré.

## Conséquences

- Aucun header custom requis.
- Un client OpenAI-compatible peut utiliser `http://localhost:18765/c/opengate-dev/v1` comme base URL.
- Les route profiles sont des namespaces HTTP, ce qui facilite le caching, le logging et le routage.
