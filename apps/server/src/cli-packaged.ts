#!/usr/bin/env node
/**
 * Dedicated packaging entrypoint for OpenGate SEA.
 * Inlines the React UI HTML only during this specific build phase.
 */

import { parseArgsAndRun } from "./cli-core.js"
// @ts-ignore
import indexHtml from "../../../apps/web/dist/index.html" with { type: "text" }

parseArgsAndRun({
  injectSpaFallback: () => indexHtml,
}).catch(console.error)
