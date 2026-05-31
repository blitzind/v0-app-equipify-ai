/**
 * Layout observer for manual comparison against other extensions (audit only).
 */
;(function initEquipifyGrowthLayoutObserver() {
  const LOG_PREFIX = "[Equipify Sales:layout-observer]"
  const PANEL_WIDTH_PX = 420

  function isHtmlElement(node) {
    return Boolean(node && typeof node === "object" && node.nodeType === 1)
  }

  function rectSummary(node) {
    if (!isHtmlElement(node)) return null
    const rect = node.getBoundingClientRect()
    return {
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      left: Math.round(rect.left),
      right: Math.round(rect.right),
      top: Math.round(rect.top),
      bottom: Math.round(rect.bottom),
    }
  }

  function inlineStyleSummary(node) {
    if (!isHtmlElement(node)) return null
    const style = node.getAttribute("style")
    return style?.trim() ? style.trim() : null
  }

  function findMain(doc) {
    return (
      doc.querySelector(".scaffold-layout__main") ??
      doc.querySelector("main.scaffold-layout__main") ??
      doc.querySelector('main[role="main"]') ??
      doc.querySelector("main")
    )
  }

  function findScaffold(doc) {
    return doc.querySelector(".scaffold-layout") ?? doc.querySelector(".scaffold-layout-container")
  }

  function findContent(doc, main) {
    return (
      doc.querySelector(".scaffold-layout__content") ??
      main?.querySelector(".scaffold-layout__content") ??
      doc.getElementById("main-content")
    )
  }

  function findVisibleRightRail(doc) {
    const selectors = [
      ".scaffold-layout__aside",
      ".scaffold-layout__sidebar",
      "aside.scaffold-layout__aside",
      ".right-rail",
    ]
    for (const selector of selectors) {
      const nodes = doc.querySelectorAll(selector)
      for (const node of nodes) {
        if (!isHtmlElement(node)) continue
        const rect = node.getBoundingClientRect()
        if (rect.width > 40 && rect.height > 40 && rect.right > window.innerWidth * 0.55) {
          return { selector, rect: rectSummary(node) }
        }
      }
    }
    return null
  }

  function measureOverlap(mainRect, panelRect) {
    if (!mainRect || !panelRect) return 0
    const overlap = Math.min(mainRect.right, panelRect.left + panelRect.width) - Math.max(mainRect.left, panelRect.left)
    return Math.max(0, Math.round(overlap))
  }

  function measureGap(mainRect, panelRect, viewportWidth) {
    if (!mainRect || !panelRect) return null
    const panelLeft = panelRect.left
    const mainRight = mainRect.right
    if (panelLeft >= mainRight) return Math.round(panelLeft - mainRight)
    if (mainRight > viewportWidth - PANEL_WIDTH_PX) return 0
    return Math.round(viewportWidth - PANEL_WIDTH_PX - mainRight)
  }

  function resolvePositionStrategy(doc) {
    const body = doc.body
    if (!body) return "unknown"
    if (body.classList.contains("equipify-layout-push-mode")) return "push_body_padding"
    if (body.classList.contains("equipify-sales-inpage-sidebar-open")) return "overlay_fixed_panel"
    return "closed"
  }

  function observeLayout(options = {}) {
    const doc = options.document ?? document
    const view = doc.defaultView ?? window
    const viewportWidth = options.viewportWidth ?? view.innerWidth ?? null
    const panelNode =
      options.panelNode ??
      doc.getElementById("equipify-sales-inpage-sidebar-root")?.querySelector(".equipify-sales-inpage-sidebar-panel") ??
      null
    const mainNode = options.mainNode ?? findMain(doc)
    const scaffoldNode = options.scaffoldNode ?? findScaffold(doc)
    const contentNode = options.contentNode ?? findContent(doc, mainNode)
    const panelRect = rectSummary(panelNode)
    const mainRect = rectSummary(mainNode)
    const payload = {
      body_classes: doc.body?.className ?? "",
      html_classes: doc.documentElement?.className ?? "",
      body_style: inlineStyleSummary(doc.body),
      html_style: inlineStyleSummary(doc.documentElement),
      visible_right_rail: findVisibleRightRail(doc),
      panel_rect: panelRect,
      main_rect: mainRect,
      scaffold_rect: rectSummary(scaffoldNode),
      content_rect: rectSummary(contentNode),
      viewport_width: viewportWidth,
      overlap_px: measureOverlap(mainRect, panelRect),
      gap_px: measureGap(mainRect, panelRect, viewportWidth ?? 0),
      position_strategy: resolvePositionStrategy(doc),
    }
    console.log(LOG_PREFIX, payload)
    return payload
  }

  window.EquipifyGrowthLayoutObserver = {
    PANEL_WIDTH_PX,
    observeLayout,
  }
})()
