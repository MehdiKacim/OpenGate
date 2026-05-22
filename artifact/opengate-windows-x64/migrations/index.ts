import { type Kysely } from "kysely"
import type { Database } from "../schema.js"
import * as m001 from "./001_initial.js"

export interface Migration {
  name: string
  up(db: Kysely<Database>): Promise<void>
  down(db: Kysely<Database>): Promise<void>
}

export const migrations: Migration[] = [
  { name: "001_initial", up: m001.up, down: m001.down },
]
