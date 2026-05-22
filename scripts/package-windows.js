#!/usr/bin/env node
/**
 * Windows packaging script for OpenGate.
 * Strategy: Bundle with esbuild + Build a real native Single Executable Application (.exe)
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
  console.log("\n--- 1. Bundling du serveur avec esbuild ---")
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

  // On compile tout le serveur et ses dépendances de production dans un seul fichier magique index.js
  sh(`npx esbuild apps/server/src/index.ts --bundle --platform=node --target=node20 --minify --outfile="${outDir}/dist-server.js" --external:better-sqlite3`)

  console.log("\n--- 2. Préparation du binaire Node.js de base ---")
  const nodeExePath = join(outDir, "node.exe")
  // Copie le binaire node de la machine de build vers l'artefact
  copyFileSync(process.execPath, nodeExePath)

  console.log("\n--- 3. Génération de la configuration SEA ---")
  const seaConfig = {
    main: join(outDir, "dist-server.js"),
    output: join(outDir, "opengate.blob")
  }
  const configPath = join(outDir, "sea-config.json")
  writeFileSync(configPath, JSON.stringify(seaConfig, null, 2))

  // Génération du blob
  sh(`node --experimental-sea-config "${configPath}"`)

  console.log("\n--- 4. Injection du code dans l'exécutable ---")
  const finalExe = join(outDir, "opengate.exe")
  
  // Utilisation de npx postject pour injecter le blob JS directement dans le binaire node.exe
  sh(`npx postject "${nodeExePath}" NODE_SEA_BLOB "${join(outDir, "opengate.blob")}" --sentinel "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2"`)
  
  // Renommer le binaire customisé
  import('node:fs').then(fs => fs.renameSync(nodeExePath, finalExe))

  console.log("\n--- 5. Copie des Assets (Web static & Migrations) ---")
  // Copie Web
  const webDistSrc = join(root, 'apps', 'web', 'dist')
  const webDistDst = join(outDir, 'apps', 'web', 'dist')
  if (existsSync(webDistSrc)) {
    mkdirSync(webDistDst, { recursive: true })
    sh(`xcopy /E /I /Y "${webDistSrc}" "${webDistDst}"`)
  }

  // Copie DB Migrations
  const migrationsSrc = join(root, 'packages', 'db', 'src', 'migrations')
  const migrationsDst = join(outDir, 'packages', 'db', 'src', 'migrations')
  if (existsSync(migrationsSrc)) {
    mkdirSync(migrationsDst, { recursive: true })
    sh(`xcopy /E /I /Y "${migrationsSrc}" "${migrationsDst}"`)
  }

  // Nettoyage des fichiers intermédiaires de build
  rmSync(configPath)
  rmSync(join(outDir, "opengate.blob"))
  rmSync(join(outDir, "dist-server.js"))

  console.log("\n--- 6. Compression finale de l'artefact ---")
  sh(`7z a "${zipPath}" "${outDir}\\*"`)
  console.log(`\nSuccès ! Ton archive contient un vrai opengate.exe indépendant : ${zipPath}`)
}

clean()
buildExecutable()
