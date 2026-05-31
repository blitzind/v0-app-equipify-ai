/**
 * LinkedIn page layout push helpers for the in-page Equipify Sales sidebar.
 */
;(function initEquipifyGrowthLayoutPush() {
  const SIDEBAR_WIDTH_PX = 420
  const DESKTOP_MIN_WIDTH = 901
  const BODY_CLASS = "equipify-sales-inpage-sidebar-open"
  const PUSH_CLASS = "equipify-sales-inpage-sidebar-push"
  const CSS_VAR_NAME = "--equipify-sales-sidebar-width"
  const LAYOUT_RESERVE_SELECTORS = [
    ".scaffold-layout",
    ".scaffold-layout__inner",
    ".scaffold-layout__main",
    "main.scaffold-layout__main",
    ".application-outlet",
    "#main-content",
    'main[role="main"]',
  ]
  const LAYOUT_EXCLUDE_SELECTORS = [".global-nav", "nav.global-nav"]
  const LAYOUT_STYLE_PROPS = ["marginRight", "maxWidth", "width", "paddingRight", "boxSizing"]

  function isHtmlElement(node) {
    return Boolean(node && typeof node === "object" && node.nodeType === 1 && node.style)
  }

  function resolveLayoutMode(viewportWidth = window.innerWidth) {
    return viewportWidth >= DESKTOP_MIN_WIDTH ? "push" : "overlay"
  }

  function isExcludedLayoutNode(node) {
    if (!isHtmlElement(node)) return true
    return LAYOUT_EXCLUDE_SELECTORS.some((selector) => node.matches?.(selector) || node.closest?.(selector))
  }

  function readStoredInlineStyles(node) {
    const raw = node.dataset.equipifyLayoutPushStored
    if (!raw) return null
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }

  function storeInlineStyles(node) {
    if (!isHtmlElement(node) || node.dataset.equipifyLayoutPushStored) return
    const stored = {}
    for (const prop of LAYOUT_STYLE_PROPS) {
      stored[prop] = node.style[prop] || ""
    }
    node.dataset.equipifyLayoutPushStored = JSON.stringify(stored)
  }

  function restoreInlineStyles(node) {
    if (!isHtmlElement(node)) return false
    const stored = readStoredInlineStyles(node)
    if (!stored) return false
    for (const prop of LAYOUT_STYLE_PROPS) {
      node.style[prop] = stored[prop] ?? ""
    }
    delete node.dataset.equipifyLayoutPushStored
    delete node.dataset.equipifyLayoutPushSource
    delete node.dataset.equipifySidebarReserveBeforeWidth
    delete node.dataset.equipifySidebarReserve
    return true
  }

  function applyReserveToNode(node, open, source, viewportWidth = window.innerWidth) {
    if (!isHtmlElement(node) || isExcludedLayoutNode(node)) return false

    if (open) {
      if (resolveLayoutMode(viewportWidth) !== "push") return false
      storeInlineStyles(node)
      node.dataset.equipifyLayoutPushSource = source
      if (!node.dataset.equipifySidebarReserveBeforeWidth) {
        node.dataset.equipifySidebarReserveBeforeWidth = String(Math.round(node.getBoundingClientRect().width))
      }
      node.dataset.equipifySidebarReserve = source
      const width = `${SIDEBAR_WIDTH_PX}px`
      node.style.marginRight = width
      node.style.maxWidth = `calc(100% - ${width})`
      node.style.boxSizing = "border-box"
      return true
    }

    return restoreInlineStyles(node)
  }

  function restoreAllLayoutReserve(doc = document) {
    const restored = []
    doc.querySelectorAll("[data-equipify-layout-push-stored]").forEach((node) => {
      const source = isHtmlElement(node) ? node.dataset.equipifyLayoutPushSource ?? "unknown" : "unknown"
      if (restoreInlineStyles(node)) restored.push(source)
    })
    return restored
  }

  function setSidebarWidthVariable(open, mode, root = document.documentElement) {
    if (open && mode === "push") {
      root.style.setProperty(CSS_VAR_NAME, `${SIDEBAR_WIDTH_PX}px`)
      return
    }
    root.style.removeProperty(CSS_VAR_NAME)
  }

  function setPushModeClass(open, mode, root = document.documentElement) {
    root.classList.toggle(PUSH_CLASS, open && mode === "push")
  }

  function describeLayoutNode(node, describeElement) {
    return describeElement?.(node) ?? node?.tagName?.toLowerCase() ?? null
  }

  function buildShiftedSelectorEntry(node, selector, describeElement) {
    const rect = node.getBoundingClientRect()
    const style = window.getComputedStyle(node)
    const entry = {
      selector,
      node: describeLayoutNode(node, describeElement),
      margin_right: style.marginRight,
      max_width: style.maxWidth,
      width: Math.round(rect.width),
    }
    if (node.dataset.equipifySidebarReserveBeforeWidth) {
      entry.before_width = Number(node.dataset.equipifySidebarReserveBeforeWidth)
    }
    return entry
  }

  function applyLayoutReserve(open, options = {}) {
    const doc = options.document ?? document
    const root = options.root ?? doc.documentElement
    const viewportWidth = options.viewportWidth ?? window.innerWidth
    const mode = resolveLayoutMode(viewportWidth)
    const shifted_selectors = []
    let restored = []
    const discoverLayoutContainer = options.discoverLayoutContainer ?? (() => null)
    const describeElement = options.describeElement ?? null
    const logLayoutPush = options.logLayoutPush ?? (() => {})

    if (!open) {
      restored = restoreAllLayoutReserve(doc)
      setSidebarWidthVariable(false, mode, root)
      setPushModeClass(false, mode, root)
      logLayoutPush({
        mode,
        panel_width: SIDEBAR_WIDTH_PX,
        shifted_selectors,
        restored,
      })
      return { mode, shifted_selectors, restored }
    }

    restoreAllLayoutReserve(doc)
    setSidebarWidthVariable(open, mode, root)
    setPushModeClass(open, mode, root)

    if (mode !== "push") {
      logLayoutPush({
        mode: "overlay",
        panel_width: SIDEBAR_WIDTH_PX,
        shifted_selectors,
        restored: [],
      })
      return { mode: "overlay", shifted_selectors, restored: [] }
    }

    const shiftedNodes = new Set()
    const discovered = discoverLayoutContainer()
    if (discovered && isHtmlElement(discovered) && applyReserveToNode(discovered, true, "discovered-main-content", viewportWidth)) {
      shiftedNodes.add(discovered)
      shifted_selectors.push(buildShiftedSelectorEntry(discovered, "discovered-main-content", describeElement))
    }

    for (const selector of LAYOUT_RESERVE_SELECTORS) {
      doc.querySelectorAll(selector).forEach((node) => {
        if (!isHtmlElement(node)) return
        if (shiftedNodes.has(node)) return
        if (isExcludedLayoutNode(node)) return
        if (applyReserveToNode(node, true, selector, viewportWidth)) {
          shiftedNodes.add(node)
          shifted_selectors.push(buildShiftedSelectorEntry(node, selector, describeElement))
        }
      })
    }

    logLayoutPush({
      mode: "push",
      panel_width: SIDEBAR_WIDTH_PX,
      shifted_selectors,
      restored: [],
    })
    return { mode: "push", shifted_selectors, restored: [] }
  }

  window.EquipifyGrowthLayoutPush = {
    BODY_CLASS,
    PUSH_CLASS,
    CSS_VAR_NAME,
    SIDEBAR_WIDTH_PX,
    DESKTOP_MIN_WIDTH,
    LAYOUT_RESERVE_SELECTORS,
    LAYOUT_EXCLUDE_SELECTORS,
    resolveLayoutMode,
    applyReserveToNode,
    restoreAllLayoutReserve,
    applyLayoutReserve,
    setSidebarWidthVariable,
    setPushModeClass,
  }
})()
