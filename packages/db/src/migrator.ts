import { type Kysely, Migrator } from "kysely"
import type { Database } from "./schema.js"
import { migrations } from "./migrations/index.js"

export async function migrateToLatest(db: Kysely<Database>): Promise<void> {
  const migrator = new Migrator({
    db,
    provider: {
      async getMigrations() {
        const record: Record<string, { up: (db: Kysely<Database>) => Promise<void>; down: (db: Kysely<Database>) => Promise<void> }> = {}
        for (const m of migrations) {
          record[m.name] = {
            up: async (trx: Kysely<Database>) => m.up(trx),
            down: async (trx: Kysely<Database>) => m.down(trx),
          }
        }
        return record
      },
    },
  })

  const { error, results } = await migrator.migrateToLatest()
  if (error) {
    throw error
  }
  for (const result of results ?? []) {
    if (result.status === "Error") {
      throw new Error(`Migration ${result.migrationName} failed`)
    }
  }
}
