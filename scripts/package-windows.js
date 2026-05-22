#!/usr/bin/env node
/**
 * Windows packaging script for OpenGate.
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

  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

  // Ajout de --fallback-to-source pour tolérer les échecs de build bytecode liés à Hono
  sh("npx pkg apps/server/dist/index.js --options fallback-to-source --out-path artifact/opengate-windows-x64")

  const exePath = join(outDir, "index.exe")
  const finalExe = join(outDir, "opengate.exe")
  if (existsSync(exePath)) {
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

  // Syntaxe pnpm deploy corrigée sans l'argument 'prod' en trop
  // NOTE: Remplace "server" par le "name" exact défini dans apps/server/package.json si différent (ex: @opengate/server)
  console.log("Deploying server app with production dependencies...")
  sh(`pnpm --filter server deploy "${outDir}"`)

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

  if (existsSync(join(root, "README.md"))) {
    copyFileSync(join(root, "README.md"), join(outDir, "README.md"))
  }

  const launcher = `@echo off
setlocal
set "NODE_ENV=production"
node "%~dp0index.js" %*
`
  writeFileSync(join(outDir, "opengate.bat"), launcher, "utf-8")

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
