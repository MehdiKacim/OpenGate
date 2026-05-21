# ADR 0002 : SQLite comme source de vérité runtime

## Contexte

L’archive utilisait un fichier `config.json` comme configuration runtime. Cela causait des problèmes de concurrence, de validation et de migration.

## Décision

SQLite est la source de vérité runtime. JSON n’est utilisé que pour import/export, backups et exemples.

## Stack choisie

- `better-sqlite3` comme driver (synchrone, compatible Node/Bun).
- `Kysely` comme query builder typé.
- Migrations explicites versionnées.
- Zod pour la validation des imports JSON.

## Conséquences

- Transactions atomiques pour toute modification de configuration.
- Requêtes SQL typées grâce à Kysely.
- Pas d’ORM magique ; le schéma est explicite.
- Le JSON reste utile pour partager des presets ou migrer des données.
