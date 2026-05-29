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
  GROWTH_BROWSER_EXTENSION_QA_MARKER,
} from "../lib/growth/browser-intake/extension-install-types"

assert.equal(GROWTH_BROWSER_EXTENSION_QA_MARKER, "growth-browser-extension-install-v1")
assert.equal(GROWTH_BROWSER_EXTENSION_DOWNLOAD_PATH, "/downloads/growth-browser-intake.zip")

const packageScript = fs.readFileSync(
  path.join(process.cwd(), "scripts/package-growth-browser-intake-extension.ts"),
  "utf8",
)
assert.match(packageScript, /GROWTH_BROWSER_EXTENSION_PACKAGE_FILES/)
assert.match(packageScript, /public\/downloads/)
assert.match(packageScript, /growth-browser-intake\.zip/)

const cardSource = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-browser-extension-install-card.tsx"),
  "utf8",
)
assert.match(cardSource, /Chrome Extension/)
assert.match(cardSource, /View install instructions/)
assert.match(cardSource, /Download ZIP/)
assert.match(cardSource, /GROWTH_BROWSER_EXTENSION_DIR/)
assert.doesNotMatch(cardSource, /api[_-]?key|secret|password|token/i)

const browserIntakePage = fs.readFileSync(
  path.join(process.cwd(), "app/(admin)/admin/growth/browser-intake-test/page.tsx"),
  "utf8",
)
assert.match(browserIntakePage, /GrowthBrowserExtensionInstallCard/)

const acquisitionPage = fs.readFileSync(
  path.join(process.cwd(), "app/(admin)/admin/growth/acquisition/page.tsx"),
  "utf8",
)
assert.match(acquisitionPage, /GrowthBrowserExtensionInstallCard/)

const settingsPanel = fs.readFileSync(
  path.join(process.cwd(), "components/growth/growth-engine-settings-panel.tsx"),
  "utf8",
)
assert.match(settingsPanel, /GrowthBrowserExtensionInstallCard/)

execSync("pnpm package:growth-extension", { stdio: "inherit" })

const zipPath = path.join(process.cwd(), "public/downloads/growth-browser-intake.zip")
assert.ok(fs.existsSync(zipPath), "Expected packaged ZIP to exist after package script.")

const zipListing = execSync(`unzip -l "${zipPath}"`, { encoding: "utf8" })
for (const file of GROWTH_BROWSER_EXTENSION_PACKAGE_FILES) {
  assert.match(zipListing, new RegExp(`growth-browser-intake/${file.replace(".", "\\.")}`))
}

console.log("growth-browser-extension-install checks passed")
