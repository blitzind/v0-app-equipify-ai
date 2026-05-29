/**
 * Verify Growth Browser Extension ZIP is present, complete, and not stale.
 * Run: pnpm check:growth-extension-package
 */
import { GROWTH_EXTENSION_STALE_ZIP_MESSAGE, verifyGrowthExtensionPackage } from "./lib/growth-extension-package"

try {
  verifyGrowthExtensionPackage()
  console.log("growth-extension-package check passed")
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes(GROWTH_EXTENSION_STALE_ZIP_MESSAGE)) {
    console.error(message)
    process.exit(1)
  }
  console.error(message)
  process.exit(1)
}
