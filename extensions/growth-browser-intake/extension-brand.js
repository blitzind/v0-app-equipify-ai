/**
 * Single replaceable brand assets for Equipify Sales extension UI.
 * Swap DOCK_LOGO_ASSET to update the floating dock logo without touching dock code.
 */
;(function initEquipifyGrowthExtensionBrand() {
  /** @type {string} Relative path under extension root — replace this file to change the dock logo. */
  const DOCK_LOGO_ASSET = "assets/equipify-lightning.png"

  window.EquipifyGrowthExtensionBrand = {
    DOCK_LOGO_ASSET,
    dockLogoUrl() {
      return chrome.runtime.getURL(DOCK_LOGO_ASSET)
    },
  }
})()
