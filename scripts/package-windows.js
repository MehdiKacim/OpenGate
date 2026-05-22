#!/usr/bin/env node
/**
 * Windows packaging script for OpenGate.
 * Strategy:
 * 1. Try pkg (Verce/pkg) to produce a single exe.
 * 2. If pkg is unavailable or fails due to native deps (better-sqlite3),
 *    fallback to a zip containing built JS + a node launcher.
 */

import { execSync } from "node:child_process"
import {
  existsSync,
  mkdirSync,
  copyFileSync,
  writeFileSync,
  rmSync,
  readFileSync,
  statSync,
  readdirSync,
} from "node:fs"
import { join, resolve } from "node:path"

const root = resolve(".")
const outDir = join(root, "artifact", "opengate-windows-x64")
const zipPath = join(root, "opengate-windows-x64.zip")

function clean() {
  if (existsSync(outDir)) rmSync(outDir, { recursive: true })
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

  sh("npx pkg apps/server/dist/index.js --out-path artifact/opengate-windows-x64")

  const exePath = join(outDir, "index.exe")
  const finalExe = join(outDir, "opengate.exe")
  if (existsSync(exePath)) {
    sh(`move "${exePath}" "${finalExe}"`)
    console.log("pkg build succeeded: opengate.exe created")
    return true
  }
  console.log("pkg build did not produce expected exe")
  return false
}

function packageFallback() {
  console.log("\nFalling back to zip packaging...")

  if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true })
  mkdirSync(outDir, { recursive: true })

  sh(`xcopy /E /I /Y "${join(root, 'apps', 'server', 'dist')}" "${join(outDir, 'apps', 'server', 'dist')}"`)
  sh(`xcopy /E /I /Y "${join(root, 'apps', 'web', 'dist')}" "${join(outDir, 'apps', 'web', 'dist')}"`)
  sh(`xcopy /E /I /Y "${join(root, 'packages', 'db', 'src', 'migrations')}" "${join(outDir, 'migrations')}"`)

  for (const pkg of ['core', 'db', 'providers', 'routing', 'sdk', 'shared']) {
    const src = join(root, 'packages', pkg, 'dist')
    const dst = join(outDir, 'packages', pkg, 'dist')
    if (existsSync(src)) {
      sh(`xcopy /E /I /Y "${src}" "${dst}"`)
    }
  }

  copyFileSync(join(root, "pnpm-lock.yaml"), join(outDir, "pnpm-lock.yaml"))
  copyFileSync(join(root, "package.json"), join(outDir, "package.json"))

  if (existsSync(join(root, "README.md"))) {
    copyFileSync(join(root, "README.md"), join(outDir, "README.md"))
  }

  const launcher = `@echo off
setlocal
set "NODE_ENV=production"
node "%~dp0apps\\server\\dist\\index.js" %*
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
