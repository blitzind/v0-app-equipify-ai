/**
 * Single replaceable brand assets for Equipify Sales extension UI.
 * Swap asset paths here to update dock/panel logos without touching feature code.
 */
;(function initEquipifyGrowthExtensionBrand() {
  /** @type {string} Relative path under extension root — floating dock + LinkedIn badge. */
  const DOCK_LOGO_ASSET = "assets/equipify-lightning.png"
  /** @type {string} Panel/header logo (Equipify Sales wordmark). */
  const PANEL_LOGO_ASSET = "assets/equipify-sales-logo.png"
  /** Native pixel dimensions of the panel wordmark asset (1024×214 @1x). */
  const PANEL_LOGO_INTRINSIC_WIDTH = 1024
  const PANEL_LOGO_INTRINSIC_HEIGHT = 214

  function applyPanelLogo(img) {
    if (!(img instanceof HTMLImageElement)) return
    img.src = chrome.runtime.getURL(PANEL_LOGO_ASSET)
    img.width = PANEL_LOGO_INTRINSIC_WIDTH
    img.height = PANEL_LOGO_INTRINSIC_HEIGHT
    img.decoding = "async"
    img.loading = "eager"
  }

  window.EquipifyGrowthExtensionBrand = {
    DOCK_LOGO_ASSET,
    PANEL_LOGO_ASSET,
    PANEL_LOGO_INTRINSIC_WIDTH,
    PANEL_LOGO_INTRINSIC_HEIGHT,
    dockLogoUrl() {
      return chrome.runtime.getURL(DOCK_LOGO_ASSET)
    },
    panelLogoUrl() {
      return chrome.runtime.getURL(PANEL_LOGO_ASSET)
    },
    applyPanelLogo,
  }
})()
