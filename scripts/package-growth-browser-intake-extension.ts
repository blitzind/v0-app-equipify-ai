/**
 * Package the Growth Browser Intake Chrome extension for admin download.
 * Run: pnpm package:growth-extension
 */
import path from "node:path"
import { formatGrowthBrowserExtensionPackageMetadata } from "../lib/growth/browser-intake/extension-package-metadata-types"
import {
  getGrowthExtensionZipPath,
  packageGrowthBrowserExtension,
} from "./lib/growth-extension-package"

const metadata = packageGrowthBrowserExtension()
const zipPath = getGrowthExtensionZipPath()

console.log(`Packaged Growth Browser Intake extension → ${path.relative(process.cwd(), zipPath)}`)
console.log(formatGrowthBrowserExtensionPackageMetadata(metadata))
