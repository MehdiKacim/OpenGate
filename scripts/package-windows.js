#!/usr/bin/env node
/**
 * Windows packaging script for OpenGate.
 * Strategy: Compiles apps/server/src/cli.ts into a single standalone native opengate.exe
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
  console.log("\n--- 1. Bundling global de la CLI et du Serveur via esbuild ---")
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

  // Compilation de la CLI (qui englobe le serveur) en résolvant tous les workspaces locaux
  // On exclut les éventuels drivers natifs s'il y en a (ici configuré pour rester générique)
  sh(`npx esbuild apps/server/src/cli.ts --bundle --platform=node --target=node20 --minify --outfile="${outDir}/dist-cli.js"`)

  console.log("\n--- 2. Préparation du moteur d'exécution Node.js natif ---")
  const nodeExePath = join(outDir, "node.exe")
  // Copie l'exécutable node.exe de la machine de build actuelle
  copyFileSync(process.execPath, nodeExePath)

  console.log("\n--- 3. Configuration et génération du blob SEA ---")
  const seaConfig = {
    main: join(outDir, "dist-cli.js"),
    output: join(outDir, "opengate.blob")
  }
  const configPath = join(outDir, "sea-config.json")
  writeFileSync(configPath, JSON.stringify(seaConfig, null, 2))

  // Compilation du code JS bundlé en blob binaire injectable
  sh(`node --experimental-sea-config "${configPath}"`)

  console.log("\n--- 4. Injection du code à l'intérieur du binaire ---")
  const finalExe = join(outDir, "opengate.exe")
  
  // Outil officiel Node.js pour fusionner le blob dans l'exécutable Windows
  sh(`npx postject "${nodeExePath}" NODE_SEA_BLOB "${join(outDir, "opengate.blob")}" --sentinel "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2"`)
  
  // Renommage du binaire Node modifié en notre commande finale
  import('node:fs').then(fs => fs.renameSync(nodeExePath, finalExe))

  console.log("\n--- 5. Intégration des assets complémentaires (Web & Migrations) ---")
  // Copie de l'application Web (Frontend statique servi par Hono)
  const webDistSrc = join(root, 'apps', 'web', 'dist')
  const webDistDst = join(outDir, 'apps', 'web', 'dist')
  if (existsSync(webDistSrc)) {
    mkdirSync(webDistDst, { recursive: true })
    sh(`xcopy /E /I /Y "${webDistSrc}" "${webDistDst}"`)
  }

  // Copie des migrations de base de données (Kysely) requises lors du `migrateToLatest` au boot
  const migrationsSrc = join(root, 'packages', 'db', 'src', 'migrations')
  const migrationsDst = join(outDir, 'packages', 'db', 'src', 'migrations')
  if (existsSync(migrationsSrc)) {
    mkdirSync(migrationsDst, { recursive: true })
    sh(`xcopy /E /I /Y "${migrationsSrc}" "${migrationsDst}"`)
  }

  // Copie du README
  if (existsSync(join(root, "README.md"))) {
    copyFileSync(join(root, "README.md"), join(outDir, "README.md"))
  }

  // Nettoyage des fichiers intermédiaires pour garder l'artefact clean
  rmSync(configPath)
  rmSync(join(outDir, "opengate.blob"))
  rmSync(join(outDir, "dist-cli.js"))

  console.log("\n--- 6. Compression ultra-rapide de l'artefact avec 7-Zip ---")
  sh(`7z a "${zipPath}" "${outDir}\\*"`)
  console.log(`\nFait ! Ton archive Windows contient maintenant un vrai 'opengate.exe' indépendant : ${zipPath}`)
}

clean()
buildExecutable()
