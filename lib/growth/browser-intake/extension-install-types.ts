/** Chrome extension install helpers — client-safe. */

export const GROWTH_BROWSER_EXTENSION_QA_MARKER = "growth-browser-extension-install-v1" as const

export const GROWTH_BROWSER_EXTENSION_DIR = "extensions/growth-browser-intake" as const

export const GROWTH_BROWSER_EXTENSION_PACKAGE_FOLDER = "equipify-sales" as const

export const GROWTH_BROWSER_EXTENSION_DOWNLOAD_PATH = "/downloads/equipify-sales.zip" as const

export const GROWTH_BROWSER_EXTENSION_PACKAGE_FILES = [
  "manifest.json",
  "background.js",
  "popup.html",
  "popup.js",
  "popup.css",
  "sidepanel.html",
  "sidepanel.js",
  "intake-app.js",
  "extension-config.js",
  "extension-storage.js",
  "extension-version.js",
  "extension-lookup-cache.js",
  "extension-ui.js",
  "assets/equipify-logo.png",
  "extension-prospect-queue.js",
  "extension-analytics.js",
  "extension-copilot.js",
  "extension-phase2.js",
  "linkedin-company-people.js",
  "linkedin-context.js",
  "linkedin-status-shared.js",
  "linkedin-crm-shared.js",
  "linkedin-crm-overlay.js",
  "linkedin-crm-overlay.css",
  "page-metadata.js",
] as const

export const GROWTH_BROWSER_EXTENSION_INSTALL_STEPS = [
  "Sign in to app.equipify.ai as a platform admin in Chrome.",
  "Open chrome://extensions and enable Developer mode.",
  "Choose Load unpacked and select the extensions/growth-browser-intake folder from this repo.",
  "Or download the Equipify Sales ZIP, unzip it, and load the extracted equipify-sales folder.",
  "Pin Equipify Sales. Use the toolbar popup or Chrome side panel to capture contacts into Growth Engine.",
] as const
