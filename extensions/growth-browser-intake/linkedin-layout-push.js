/**
 * LinkedIn page layout push helpers for the in-page Equipify Sales sidebar.
 */
;(function initEquipifyGrowthLayoutPush() {
  const SIDEBAR_WIDTH_PX = 420
  const DESKTOP_MIN_WIDTH = 901
  const BODY_CLASS = "equipify-sales-inpage-sidebar-open"
  const PUSH_CLASS = "equipify-sales-inpage-sidebar-push"
  const CSS_VAR_NAME = "--equipify-sales-sidebar-width"
  const MIN_WIDTH_DELTA_PX = 80
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
  const LAYOUT_STYLE_PROPS = [
    "marginRight",
    "marginLeft",
    "maxWidth",
    "width",
    "paddingRight",
    "boxSizing",
    "transform",
    "transformOrigin",
  ]

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
    delete node.dataset.equipifyLayoutPushStrategy
    delete node.dataset.equipifySidebarReserveBeforeWidth
    delete node.dataset.equipifySidebarReserve
    return true
  }

  function describeRect(node) {
    if (!isHtmlElement(node)) return null
    const rect = node.getBoundingClientRect()
    return {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      right: Math.round(rect.right),
    }
  }

  function applyShrinkWidthReserve(node, panelWidth) {
    const width = `${panelWidth}px`
    node.style.boxSizing = "border-box"
    node.style.width = `calc(100% - ${width})`
    node.style.maxWidth = `calc(100% - ${width})`
    node.style.marginRight = width
  }

  function applyTransformFallback(node, panelWidth) {
    node.style.transformOrigin = "top center"
    node.style.transform = `translateX(calc(-1 * ${panelWidth / 2}px))`
  }

  function applyReserveToNode(node, open, source, viewportWidth = window.innerWidth, strategy = "margin-reserve") {
    if (!isHtmlElement(node) || isExcludedLayoutNode(node)) return false

    if (open) {
      if (resolveLayoutMode(viewportWidth) !== "push") return false
      storeInlineStyles(node)
      node.dataset.equipifyLayoutPushSource = source
      node.dataset.equipifyLayoutPushStrategy = strategy
      if (!node.dataset.equipifySidebarReserveBeforeWidth) {
        node.dataset.equipifySidebarReserveBeforeWidth = String(Math.round(node.getBoundingClientRect().width))
      }
      node.dataset.equipifySidebarReserve = source

      if (strategy === "shrink-width") {
        applyShrinkWidthReserve(node, SIDEBAR_WIDTH_PX)
      } else if (strategy === "transform-fallback") {
        applyTransformFallback(node, SIDEBAR_WIDTH_PX)
      } else {
        const width = `${SIDEBAR_WIDTH_PX}px`
        node.style.marginRight = width
        node.style.maxWidth = `calc(100% - ${width})`
        node.style.boxSizing = "border-box"
      }
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

  function buildShiftedSelectorEntry(node, selector, describeElement, strategy) {
    const rect = node.getBoundingClientRect()
    const style = window.getComputedStyle(node)
    const entry = {
      selector,
      node: describeLayoutNode(node, describeElement),
      strategy,
      margin_right: style.marginRight,
      max_width: style.maxWidth,
      width: Math.round(rect.width),
      transform: style.transform,
    }
    if (node.dataset.equipifySidebarReserveBeforeWidth) {
      entry.before_width = Number(node.dataset.equipifySidebarReserveBeforeWidth)
    }
    return entry
  }

  function pushDiscoveredContainer(discovered, viewportWidth, shiftedNodes, shifted_selectors, describeElement) {
    if (!discovered || !isHtmlElement(discovered) || isExcludedLayoutNode(discovered)) {
      return { selected_container: null, before_rect: null, after_rect: null, strategy: null }
    }

    const before_rect = describeRect(discovered)
    let strategy = "shrink-width"
    applyReserveToNode(discovered, true, "discovered-main-content", viewportWidth, strategy)
    shiftedNodes.add(discovered)
    shifted_selectors.push(
      buildShiftedSelectorEntry(discovered, "discovered-main-content", describeElement, strategy),
    )

    let after_rect = describeRect(discovered)
    const widthDelta = (before_rect?.width ?? 0) - (after_rect?.width ?? 0)
    if (widthDelta < MIN_WIDTH_DELTA_PX) {
      strategy = "transform-fallback"
      applyTransformFallback(discovered)
      discovered.dataset.equipifyLayoutPushStrategy = strategy
      after_rect = describeRect(discovered)
      shifted_selectors[shifted_selectors.length - 1] = buildShiftedSelectorEntry(
        discovered,
        "discovered-main-content",
        describeElement,
        strategy,
      )
    }

    return {
      selected_container: describeLayoutNode(discovered, describeElement),
      before_rect,
      after_rect,
      strategy,
    }
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
        viewport_width: viewportWidth,
        panel_width: SIDEBAR_WIDTH_PX,
        selected_container: null,
        before_rect: null,
        after_rect: null,
        shifted_selectors,
        strategy: null,
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
        viewport_width: viewportWidth,
        panel_width: SIDEBAR_WIDTH_PX,
        selected_container: null,
        before_rect: null,
        after_rect: null,
        shifted_selectors,
        strategy: "overlay",
        restored: [],
      })
      return { mode: "overlay", shifted_selectors, restored: [] }
    }

    const shiftedNodes = new Set()
    const discovered = discoverLayoutContainer()
    const discoveredResult = pushDiscoveredContainer(
      discovered,
      viewportWidth,
      shiftedNodes,
      shifted_selectors,
      describeElement,
    )

    for (const selector of LAYOUT_RESERVE_SELECTORS) {
      doc.querySelectorAll(selector).forEach((node) => {
        if (!isHtmlElement(node)) return
        if (shiftedNodes.has(node)) return
        if (discovered && (node === discovered || discovered.contains?.(node) || node.contains?.(discovered))) {
          return
        }
        if (isExcludedLayoutNode(node)) return
        if (applyReserveToNode(node, true, selector, viewportWidth, "margin-reserve")) {
          shiftedNodes.add(node)
          shifted_selectors.push(buildShiftedSelectorEntry(node, selector, describeElement, "margin-reserve"))
        }
      })
    }

    logLayoutPush({
      mode: "push",
      viewport_width: viewportWidth,
      panel_width: SIDEBAR_WIDTH_PX,
      selected_container: discoveredResult.selected_container,
      before_rect: discoveredResult.before_rect,
      after_rect: discoveredResult.after_rect,
      shifted_selectors,
      strategy: discoveredResult.strategy ?? "margin-reserve",
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
    MIN_WIDTH_DELTA_PX,
    LAYOUT_RESERVE_SELECTORS,
    LAYOUT_EXCLUDE_SELECTORS,
    resolveLayoutMode,
    describeRect,
    applyReserveToNode,
    restoreAllLayoutReserve,
    applyLayoutReserve,
    setSidebarWidthVariable,
    setPushModeClass,
  }
})()
