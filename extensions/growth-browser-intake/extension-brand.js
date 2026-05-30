/**
 * Single replaceable brand assets for Equipify Sales extension UI.
 * Swap asset paths here to update dock/panel logos without touching feature code.
 */
;(function initEquipifyGrowthExtensionBrand() {
  /** @type {string} Relative path under extension root — floating dock + LinkedIn badge. */
  const DOCK_LOGO_ASSET = "assets/equipify-lightning.png"
  /** @type {string} Panel/header logo (Equipify Sales wordmark). */
  const PANEL_LOGO_ASSET = "assets/equipify-sales-logo.png"

  window.EquipifyGrowthExtensionBrand = {
    DOCK_LOGO_ASSET,
    PANEL_LOGO_ASSET,
    dockLogoUrl() {
      return chrome.runtime.getURL(DOCK_LOGO_ASSET)
    },
    panelLogoUrl() {
      return chrome.runtime.getURL(PANEL_LOGO_ASSET)
    },
  }
})()
