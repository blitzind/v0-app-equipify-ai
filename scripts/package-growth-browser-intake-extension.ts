/**
 * Package the Growth Browser Intake Chrome extension for admin download.
 * Run: pnpm package:growth-extension
 */
import assert from "node:assert/strict"
import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { GROWTH_BROWSER_EXTENSION_PACKAGE_FILES } from "../lib/growth/browser-intake/extension-install-types"

const root = process.cwd()
const extensionDir = path.join(root, "extensions/growth-browser-intake")
const outputDir = path.join(root, "public/downloads")
const outputZip = path.join(outputDir, "growth-browser-intake.zip")

assert.ok(fs.existsSync(extensionDir), `Missing extension directory: ${extensionDir}`)

for (const file of GROWTH_BROWSER_EXTENSION_PACKAGE_FILES) {
  const filePath = path.join(extensionDir, file)
  assert.ok(fs.existsSync(filePath), `Missing required extension file: ${file}`)
}

fs.mkdirSync(outputDir, { recursive: true })
if (fs.existsSync(outputZip)) fs.unlinkSync(outputZip)

execSync(`zip -r "${outputZip}" growth-browser-intake -x "*.DS_Store"`, {
  cwd: path.join(root, "extensions"),
  stdio: "inherit",
})

assert.ok(fs.existsSync(outputZip), "ZIP was not created.")

const zipListing = execSync(`unzip -l "${outputZip}"`, { encoding: "utf8" })
for (const file of GROWTH_BROWSER_EXTENSION_PACKAGE_FILES) {
  assert.match(zipListing, new RegExp(`growth-browser-intake/${file.replace(".", "\\.")}`))
}

console.log(`Packaged Growth Browser Intake extension → ${path.relative(root, outputZip)}`)
