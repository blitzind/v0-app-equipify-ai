/**
 * Single replaceable brand assets for Equipify Sales extension UI.
 * Swap asset paths here to update dock/panel logos without touching feature code.
 */
;(function initEquipifyGrowthExtensionBrand() {
  /** @type {string} Relative path under extension root — floating dock + LinkedIn badge. */
  const DOCK_LOGO_ASSET = "assets/equipify-lightning.png"
  /** @type {string} Panel/header logo (Equipify Sales wordmark, transparent PNG). */
  const PANEL_LOGO_ASSET = "assets/equipify-sales-wordmark.png"
  /** Bump when the panel wordmark asset changes to defeat Chrome asset caching. */
  const PANEL_LOGO_VERSION = "4.3.34"
  /** Native pixel dimensions of the panel wordmark asset (1024×214 @1x). */
  const PANEL_LOGO_INTRINSIC_WIDTH = 1024
  const PANEL_LOGO_INTRINSIC_HEIGHT = 214

  function panelLogoUrl() {
    return `${chrome.runtime.getURL(PANEL_LOGO_ASSET)}?v=${encodeURIComponent(PANEL_LOGO_VERSION)}`
  }

  function sampleLogoHasAlpha(img) {
    try {
      const canvas = document.createElement("canvas")
      canvas.width = 4
      canvas.height = 4
      const ctx = canvas.getContext("2d")
      if (!ctx) return null
      ctx.drawImage(img, 0, 0, 4, 4)
      const corners = [
        ctx.getImageData(0, 0, 1, 1).data[3],
        ctx.getImageData(3, 0, 1, 1).data[3],
        ctx.getImageData(0, 3, 1, 1).data[3],
        ctx.getImageData(3, 3, 1, 1).data[3],
      ]
      return corners.some((alpha) => alpha < 10)
    } catch {
      return null
    }
  }

  function logLogoAudit(img) {
    if (!(img instanceof HTMLImageElement)) return
    const wrapper = img.closest(".es-ws-brand-logo, .es-launcher-header")
    const computed = window.getComputedStyle(img)
    const wrapperComputed = wrapper ? window.getComputedStyle(wrapper) : null
    console.log("[Equipify Sales:logo-audit]", {
      loaded_logo_url: img.currentSrc || img.src,
      natural_width: img.naturalWidth,
      natural_height: img.naturalHeight,
      has_alpha: sampleLogoHasAlpha(img),
      computed_background: computed.backgroundColor,
      wrapper_background: wrapperComputed?.backgroundColor ?? null,
    })
  }

  function applyPanelLogo(img) {
    if (!(img instanceof HTMLImageElement)) return
    const url = panelLogoUrl()
    const onReady = () => logLogoAudit(img)
    img.addEventListener("load", onReady, { once: true })
    img.addEventListener("error", () => {
      console.error("[Equipify Sales:logo-audit]", {
        loaded_logo_url: url,
        error: "panel-logo-load-failed",
      })
    }, { once: true })
    img.src = url
    img.width = PANEL_LOGO_INTRINSIC_WIDTH
    img.height = PANEL_LOGO_INTRINSIC_HEIGHT
    img.decoding = "async"
    img.loading = "eager"
    img.style.background = "transparent"
    img.style.backgroundColor = "transparent"
    img.style.boxShadow = "none"
    if (img.complete) onReady()
  }

  window.EquipifyGrowthExtensionBrand = {
    DOCK_LOGO_ASSET,
    PANEL_LOGO_ASSET,
    PANEL_LOGO_VERSION,
    PANEL_LOGO_INTRINSIC_WIDTH,
    PANEL_LOGO_INTRINSIC_HEIGHT,
    dockLogoUrl() {
      return chrome.runtime.getURL(DOCK_LOGO_ASSET)
    },
    panelLogoUrl,
    applyPanelLogo,
    logLogoAudit,
  }
})()
