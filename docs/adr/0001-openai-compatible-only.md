# ADR 0001 : OpenAI-compatible core only

## Contexte

OpenGate hérite d’un historique où les endpoints Anthropic (`/v1/messages`) étaient supportés nativement, avec un bridge OpenAI↔Anthropic.

## Décision

OpenGate expose **uniquement** des endpoints compatibles OpenAI (`/v1/models`, `/v1/chat/completions`).

## Conséquences

- Les clients Anthropic (Claude Code) doivent utiliser un adaptateur côté client ou configurer OpenGate comme endpoint OpenAI-compatible.
- Le code serveur est simplifié : pas de double schéma, pas de bridge legacy.
- Le format de réponse est standard et reconnu par la majorité des outils (Continue.dev, Roo, OpenWebUI, etc.).

## Rejeté

Maintenir les endpoints Anthropic natifs. Cela complexifiait le serveur sans ajouter de valeur unique : les clients Anthropic peuvent de plus en plus utiliser des endpoints OpenAI.
