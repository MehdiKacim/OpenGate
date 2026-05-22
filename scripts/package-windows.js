#!/usr/bin/env node
/**
 * Windows packaging script for OpenGate.
 * Strategy: Bundle with esbuild using native text loaders to inline HTML assets,
 * then inject into a single fully autonomous Node SEA container.
 */

import { execSync } from "node:child_process"
import { existsSync, mkdirSync, writeFileSync, rmSync, copyFileSync, renameSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"

const root = resolve(".")

// Récupération dynamique de la version pour l'incrémentation des releases
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf-8"))
const version = pkg.version || "0.0.0"

const outDir = join(root, "artifact", `opengate-windows-x64-v${version}`)
const zipPath = join(root, `opengate-windows-x64-v${version}.zip`)

function clean() {
  const artifactRoot = join(root, "artifact")
  if (existsSync(artifactRoot)) rmSync(artifactRoot, { recursive: true, force: true })
  if (existsSync(zipPath)) rmSync(zipPath)
}

function sh(cmd) {
  console.log(`> ${cmd}`)
  return execSync(cmd, { stdio: "inherit", cwd: root, shell: true })
}

function buildExecutable() {
  console.log(`\n--- Préparation du build OpenGate v${version} ---`)
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

  console.log("\n--- 1. Bundling de la CLI et du Serveur via esbuild (Inlining HTML) ---")
  // On ajoute le loader : .html=text pour fusionner le index.html directement dans le JS généré
  sh(`pnpm dlx esbuild apps/server/src/cli.ts --bundle --platform=node --target=node20 --format=esm --minify --loader:.html=text --outfile="${join(outDir, "dist-cli.js")}"`)

  console.log("\n--- 2. Préparation du moteur d'exécution Node.js natif ---")
  const tempNodeExePath = join(outDir, "node.exe")
  copyFileSync(process.execPath, tempNodeExePath)

  console.log("\n--- 3. Configuration et génération du blob SEA ---")
  const seaConfig = {
    main: join(outDir, "dist-cli.js"),
    output: join(outDir, "opengate.blob")
  }
  const configPath = join(outDir, "sea-config.json")
  writeFileSync(configPath, JSON.stringify(seaConfig, null, 2))

  sh(`node --experimental-sea-config "${configPath}"`)

  console.log("\n--- 4. Injection du code à l'intérieur du binaire ---")
  sh(`pnpm dlx postject "${tempNodeExePath}" NODE_SEA_BLOB "${join(outDir, "opengate.blob")}" --sentinel-fuse "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2"`)
  
  // Renommage synchrone immédiat pour garantir l'identité du fichier final
  const finalExe = join(outDir, "opengate.exe")
  renameSync(tempNodeExePath, finalExe)
  console.log(`> Binaire renommé avec succès en : opengate.exe`)

  console.log("\n--- 5. Intégration de la documentation de base ---")
  if (existsSync(join(root, "README.md"))) {
    copyFileSync(join(root, "README.md"), join(outDir, "README.md"))
  }

  // Nettoyage des fichiers intermédiaires
  rmSync(configPath)
  rmSync(join(outDir, "opengate.blob"))
  rmSync(join(outDir, "dist-cli.js"))

  console.log("\n--- 6. Compression finale de l'exécutable unique ---")
  sh(`7z a "${zipPath}" "${outDir}\\*"`)
  console.log(`\nFait ! L'archive autonome générée est : opengate-windows-x64-v${version}.zip`)
}

clean()
buildExecutable()
