import DatabaseConstructor from "better-sqlite3"
import { Kysely, SqliteDialect } from "kysely"
import { dirname } from "node:path"
import { mkdirSync } from "node:fs"
import type { Database } from "./schema.js"

export function createDatabaseConnection(path: string): Kysely<Database> {
  mkdirSync(dirname(path), { recursive: true })
  const db = new DatabaseConstructor(path)
  db.pragma("journal_mode = WAL")
  db.pragma("foreign_keys = ON")

  return new Kysely<Database>({
    dialect: new SqliteDialect({
      database: db,
    }),
  })
}
