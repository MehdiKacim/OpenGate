#!/usr/bin/env node
/**
 * Windows packaging script for OpenGate.
 * Strategy: Bundle with esbuild (via pnpm dlx) and inject into Node SEA container.
 */

import { execSync } from "node:child_process"
import { existsSync, mkdirSync, writeFileSync, rmSync, copyFileSync } from "node:fs"
import { join, resolve } from "node:path"

const root = resolve(".")
const outDir = join(root, "artifact", "opengate-windows-x64")
const zipPath = join(root, "opengate-windows-x64.zip")

function clean() {
  if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true })
  if (existsSync(zipPath)) rmSync(zipPath)
}

function sh(cmd) {
  console.log(`> ${cmd}`)
  return execSync(cmd, { stdio: "inherit", cwd: root, shell: true })
}

function buildExecutable() {
  console.log("\n--- 1. Bundling de la CLI et du Serveur via esbuild ---")
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

  // Ajout de --format=esm pour préserver import.meta.url nécessaire à la détection des dossiers d'assets
  sh(`pnpm dlx esbuild apps/server/src/cli.ts --bundle --platform=node --target=node20 --format=esm --minify --outfile="${outDir}/dist-cli.js"`)

  console.log("\n--- 2. Préparation du moteur d'exécution Node.js natif ---")
  const nodeExePath = join(outDir, "node.exe")
  copyFileSync(process.execPath, nodeExePath)

  console.log("\n--- 3. Configuration et génération du blob SEA ---")
  const seaConfig = {
    main: join(outDir, "dist-cli.js"),
    output: join(outDir, "opengate.blob")
  }
  const configPath = join(outDir, "sea-config.json")
  writeFileSync(configPath, JSON.stringify(seaConfig, null, 2))

  sh(`node --experimental-sea-config "${configPath}"`)

  console.log("\n--- 4. Injection du code à l'intérieur du binaire ---")
  const finalExe = join(outDir, "opengate.exe")
  
  // Utilisation du flag correct --sentinel-fuse pour l'injection Windows PE
  sh(`pnpm dlx postject "${nodeExePath}" NODE_SEA_BLOB "${join(outDir, "opengate.blob")}" --sentinel-fuse "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2"`)
  
  import('node:fs').then(fs => fs.renameSync(nodeExePath, finalExe))

  console.log("\n--- 5. Intégration des dossiers d'assets (Web & Migrations) ---")
  // Copie de l'UI statique React/Vite
  const webDistSrc = join(root, 'apps', 'web', 'dist')
  const webDistDst = join(outDir, 'apps', 'web', 'dist')
  if (existsSync(webDistSrc)) {
    mkdirSync(webDistDst, { recursive: true })
    sh(`xcopy /E /I /Y "${webDistSrc}" "${webDistDst}"`)
  }

  // Copie des fichiers de migrations Kysely pour le schéma SQLite au boot
  const migrationsSrc = join(root, 'packages', 'db', 'src', 'migrations')
  const migrationsDst = join(outDir, 'packages', 'db', 'src', 'migrations')
  if (existsSync(migrationsSrc)) {
    mkdirSync(migrationsDst, { recursive: true })
    sh(`xcopy /E /I /Y "${migrationsSrc}" "${migrationsDst}"`)
  }

  if (existsSync(join(root, "README.md"))) {
    copyFileSync(join(root, "README.md"), join(outDir, "README.md"))
  }

  // Nettoyage des fichiers temporaires de build
  rmSync(configPath)
  rmSync(join(outDir, "opengate.blob"))
  rmSync(join(outDir, "dist-cli.js"))

  console.log("\n--- 6. Compression finale ultra-rapide avec 7-Zip ---")
  sh(`7z a "${zipPath}" "${outDir}\\*"`)
  console.log(`\nFait ! Ton archive Windows contient maintenant ton exécutable natif autonome 'opengate.exe'.`)
}

clean()
buildExecutable()
