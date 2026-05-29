/**
 * Regression checks for Growth Browser Intake extension packaging and install UI.
 * Run: pnpm test:growth-browser-extension-install
 */
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import { execSync } from "node:child_process"
import {
  GROWTH_BROWSER_EXTENSION_DOWNLOAD_PATH,
  GROWTH_BROWSER_EXTENSION_PACKAGE_FILES,
  GROWTH_BROWSER_EXTENSION_PACKAGE_FOLDER,
  GROWTH_BROWSER_EXTENSION_QA_MARKER,
} from "../lib/growth/browser-intake/extension-install-types"
import {
  GROWTH_BROWSER_EXTENSION_PACKAGE_METADATA_DOWNLOAD_PATH,
  GROWTH_BROWSER_EXTENSION_PACKAGE_METADATA_FILENAME,
} from "../lib/growth/browser-intake/extension-package-metadata-types"
import {
  GROWTH_EXTENSION_STALE_ZIP_MESSAGE,
  readExtensionManifestVersion,
} from "./lib/growth-extension-package"

assert.equal(GROWTH_BROWSER_EXTENSION_QA_MARKER, "growth-browser-extension-install-v1")
assert.equal(GROWTH_BROWSER_EXTENSION_DOWNLOAD_PATH, "/downloads/equipify-sales.zip")
assert.equal(
  GROWTH_BROWSER_EXTENSION_PACKAGE_METADATA_DOWNLOAD_PATH,
  "/downloads/equipify-sales-package-metadata.json",
)

const packageScript = fs.readFileSync(
  path.join(process.cwd(), "scripts/package-growth-browser-intake-extension.ts"),
  "utf8",
)
assert.match(packageScript, /packageGrowthBrowserExtension/)
assert.match(packageScript, /formatGrowthBrowserExtensionPackageMetadata/)

const checkScript = fs.readFileSync(
  path.join(process.cwd(), "scripts/check-growth-extension-package.ts"),
  "utf8",
)
assert.match(checkScript, /verifyGrowthExtensionPackage/)
assert.match(checkScript, /GROWTH_EXTENSION_STALE_ZIP_MESSAGE/)

const packageJson = fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8")
assert.match(packageJson, /"prebuild": "pnpm check:tracked-imports && pnpm package:growth-extension"/)
assert.match(packageJson, /"check:growth-extension-package"/)

const cardSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-browser-extension-install-card.tsx"),
  "utf8",
)
assert.match(cardSource, /Equipify Sales/)
assert.match(cardSource, /View install instructions/)
assert.match(cardSource, /Download Equipify Sales ZIP/)
assert.match(cardSource, /GROWTH_BROWSER_EXTENSION_DIR/)
assert.match(cardSource, /Latest available/)
assert.match(cardSource, /formatGrowthBrowserExtensionPackageMetadata/)
assert.match(cardSource, /GROWTH_BROWSER_EXTENSION_PACKAGE_METADATA_DOWNLOAD_PATH/)
assert.doesNotMatch(cardSource, /api[_-]?key|secret|password|token/i)

const intakeAppJs = fs.readFileSync(
  path.join(process.cwd(), "extensions/growth-browser-intake/intake-app.js"),
  "utf8",
)
assert.match(intakeAppJs, /EquipifyGrowthExtensionVersion/)
assert.match(intakeAppJs, /loadVersionInfo/)
assert.match(intakeAppJs, /extension-version-warning/)

execSync("pnpm package:growth-extension", { stdio: "inherit" })

const zipPath = path.join(process.cwd(), "public/downloads/equipify-sales.zip")
const metadataPath = path.join(process.cwd(), "public/downloads/equipify-sales-package-metadata.json")
assert.ok(fs.existsSync(zipPath), "Expected packaged ZIP to exist after package script.")
assert.ok(fs.existsSync(metadataPath), "Expected package metadata JSON beside ZIP.")

const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8")) as {
  extension_version?: string
  generated_at?: string
  git_sha?: string | null
}
assert.equal(metadata.extension_version, readExtensionManifestVersion())
assert.ok(metadata.generated_at)

const zipListing = execSync(`unzip -l "${zipPath}"`, { encoding: "utf8" })
for (const file of GROWTH_BROWSER_EXTENSION_PACKAGE_FILES) {
  assert.match(zipListing, new RegExp(`${GROWTH_BROWSER_EXTENSION_PACKAGE_FOLDER}/${file.replace(".", "\\.")}`))
}
assert.match(
  zipListing,
  new RegExp(`${GROWTH_BROWSER_EXTENSION_PACKAGE_FOLDER}/${GROWTH_BROWSER_EXTENSION_PACKAGE_METADATA_FILENAME.replace(".", "\\.")}`),
)

execSync("pnpm check:growth-extension-package", { stdio: "inherit" })

const touchTarget = path.join(process.cwd(), "extensions/growth-browser-intake/manifest.json")
const originalMtime = fs.statSync(touchTarget).mtime
const future = new Date(Date.now() + 60_000)
fs.utimesSync(touchTarget, future, future)

let staleCheckFailed = false
try {
  execSync("pnpm check:growth-extension-package", { stdio: "pipe" })
} catch (error) {
  staleCheckFailed = true
  const output =
    error instanceof Error && "stdout" in error
      ? `${String((error as { stdout?: Buffer }).stdout ?? "")}${String((error as { stderr?: Buffer }).stderr ?? "")}${error.message}`
      : String(error)
  assert.match(output, new RegExp(GROWTH_EXTENSION_STALE_ZIP_MESSAGE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
}

assert.ok(staleCheckFailed, "Expected stale ZIP guard to fail when source is newer than ZIP.")
fs.utimesSync(touchTarget, originalMtime, originalMtime)
execSync("pnpm package:growth-extension", { stdio: "inherit" })
execSync("pnpm check:growth-extension-package", { stdio: "inherit" })

console.log("growth-browser-extension-install checks passed")
