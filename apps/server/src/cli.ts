#!/usr/bin/env node
import { parseArgsAndRun } from "./cli-core.js"

parseArgsAndRun().catch((err) => {
  console.error(err)
  process.exit(1)
})
