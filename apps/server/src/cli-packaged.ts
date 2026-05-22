#!/usr/bin/env node
/**
 * Dedicated packaging entrypoint for OpenGate SEA.
 * Inlines the React UI HTML only during this specific build phase.
 */

import { serve } from "./server.js"
// Importation du CLI générique ou de la logique de configuration
// Ajuste cet import selon la façon dont ton cli.ts d'origine initialise 'opts' (ex: ports, db)
import { parseArgsAndRun } from "./cli-core.js" 

// @ts-ignore
import indexHtml from "../../../apps/web/dist/index.html" with { type: "text" }

async function main() {
  await parseArgsAndRun({
    injectSpaFallback: () => indexHtml
  })
}

main().catch(console.error)
