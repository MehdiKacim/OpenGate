#!/usr/bin/env node
/**
 * Windows packaging script for OpenGate.
 * Strategy:
 * 1. Try pkg (Yao-pkg/pkg) to produce a single exe.
 * 2. If pkg is unavailable or fails due to native deps (better-sqlite3),
 *    fallback to a zip containing built JS + an isolated production node_modules + a node launcher.
 */

import { execSync } from "node:child_process"
import {
  existsSync,
  mkdirSync,
  copyFileSync,
  writeFileSync,
  rmSync,
  readFileSync,
} from "node:fs"
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

function hasPkg() {
  try {
    execSync("npx pkg --version", { stdio: "ignore" })
    return true
  } catch {
    return false
  }
}

function packageWithPkg() {
  console.log("\nAttempting pkg build...")
  const pkgConfigPath = join(root, "package.json")
  const pkgConfig = JSON.parse(readFileSync(pkgConfigPath, "utf-8"))

  if (!pkgConfig.pkg) {
    pkgConfig.pkg = {
      scripts: [
        "apps/server/dist/**/*.js",
        "packages/*/dist/**/*.js",
      ],
      assets: [
        "apps/web/dist/**/*",
        "packages/db/src/migrations/**/*",
      ],
      targets: ["node20-win-x64"],
      outputPath: outDir,
    }
    writeFileSync(pkgConfigPath, JSON.stringify(pkgConfig, null, 2) + "\n")
    console.log("Added pkg config to package.json")
  }

  // S'assurer que le dossier de sortie existe avant que pkg n'écrive dedans
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

  sh("npx pkg apps/server/dist/index.js --out-path artifact/opengate-windows-x64")

  const exePath = join(outDir, "index.exe")
  const finalExe = join(outDir, "opengate.exe")
  if (existsSync(exePath)) {
    // Utilisation d'une commande Node robuste pour renommer plutôt que le "move" de cmd.exe
    import('node:fs').then(fs => fs.renameSync(exePath, finalExe))
    console.log("pkg build succeeded: opengate.exe created")
    return true
  }
  console.log("pkg build did not produce expected exe")
  return false
}

function packageFallback() {
  console.log("\nFalling back to standalone zip packaging...")

  if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true })
  mkdirSync(outDir, { recursive: true })

  // 1. On utilise pnpm deploy pour extraire l'application serveur et installer ses node_modules de production
  console.log("Deploying server app with production dependencies...")
  sh(`pnpm --filter opengate deploy prod "${outDir}"`)

  // 2. On s'assure que le build de l'application web est bien copié au bon endroit pour le serveur statique
  const webDistSrc = join(root, 'apps', 'web', 'dist')
  const webDistDst = join(outDir, 'apps', 'web', 'dist')
  if (existsSync(webDistSrc)) {
    mkdirSync(webDistDst, { recursive: true })
    sh(`xcopy /E /I /Y "${webDistSrc}" "${webDistDst}"`)
  }

  // 3. Copie des migrations de la base de données requises au runtime
  const migrationsSrc = join(root, 'packages', 'db', 'src', 'migrations')
  const migrationsDst = join(outDir, 'packages', 'db', 'src', 'migrations')
  if (existsSync(migrationsSrc)) {
    mkdirSync(migrationsDst, { recursive: true })
    sh(`xcopy /E /I /Y "${migrationsSrc}" "${migrationsDst}"`)
  }

  // 4. Ajout d'un fichier README informatif si disponible
  if (existsSync(join(root, "README.md"))) {
    copyFileSync(join(root, "README.md"), join(outDir, "README.md"))
  }

  // 5. Création du fichier de lancement .bat (ajusté pour pointer sur la racine du dossier déployé)
  const launcher = `@echo off
setlocal
set "NODE_ENV=production"
node "%~dp0index.js" %*
`
  writeFileSync(join(outDir, "opengate.bat"), launcher, "utf-8")

  // 6. Compression de tout le dossier autonome
  sh(`powershell -Command "Compress-Archive -Path '${outDir}\\*' -DestinationPath '${zipPath}' -Force"`)
  console.log(`Fallback zip created: ${zipPath}`)
}

clean()

let ok = false
if (hasPkg()) {
  try {
    ok = packageWithPkg()
  } catch (e) {
    console.error("pkg build failed:", e.message)
    ok = false
  }
}

if (!ok) {
  packageFallback()
} else {
  sh(`powershell -Command "Compress-Archive -Path '${outDir}\\*' -DestinationPath '${zipPath}' -Force"`)
  console.log(`Windows artifact ready: ${zipPath}`)
}