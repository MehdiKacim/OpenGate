import { createDatabaseConnection } from "./connection.js"
import { migrateToLatest } from "./migrator.js"
import { seedDefaults } from "./seeds/default.js"

export async function setupTestDb() {
  const path = `:memory:`
  const db = createDatabaseConnection(path)
  await migrateToLatest(db)
  await seedDefaults(db)
  return db
}
