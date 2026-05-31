/**
 * LinkedIn desktop layout push — hide right rail + reserve panel column (v4.3.35).
 */
;(function initEquipifyGrowthLayoutPush() {
  const SIDEBAR_WIDTH_PX = 420
  const RIGHT_MARGIN_PX = 0
  const DESKTOP_MIN_WIDTH = 1200
  const BODY_CLASS = "equipify-sales-inpage-sidebar-open"
  const DESKTOP_LAYOUT_CLASS = "equipify-desktop-layout"
  const DEBUG_LAYOUT_CLASS = "equipify-layout-debug"
  const CSS_VAR_PANEL_WIDTH = "--equipify-panel-width"
  const CSS_VAR_RIGHT_MARGIN = "--equipify-layout-right-margin"
  const CSS_VAR_MAIN_WIDTH = "--equipify-linkedin-main-width"
  const DEBUG_STORAGE_KEY = "equipify_debug_layout"
  const LAYOUT_STRATEGY = "hide-right-rail-reserve-panel"

  const SCAFFOLD_ROOT_SELECTORS = [
    ".scaffold-layout",
    ".scaffold-layout-container",
    ".application-outlet",
  ]
  const SCAFFOLD_MAIN_SELECTORS = [
    ".scaffold-layout__main",
    "main.scaffold-layout__main",
    'main[role="main"]',
  ]
  const SCAFFOLD_CONTENT_SELECTORS = [
    ".scaffold-layout__content",
    ".scaffold-layout__inner",
    "#main-content",
  ]
  const RIGHT_RAIL_SELECTORS = [
    ".scaffold-layout__aside",
    ".scaffold-layout__sidebar",
    "aside.scaffold-layout__aside",
    ".scaffold-layout aside",
    ".scaffold-layout-container aside",
    'aside[aria-label*="sidebar" i]',
    'aside[aria-label*="Right rail" i]',
    ".right-rail",
  ]

  const LAYOUT_MARK_ATTRS = [
    "data-equipify-layout-root",
    "data-equipify-layout-main",
    "data-equipify-layout-content",
    "data-equipify-layout-rail",
  ]

  function isHtmlElement(node) {
    return Boolean(node && typeof node === "object" && node.nodeType === 1)
  }

  function resolveLayoutMode(viewportWidth = window.innerWidth) {
    return viewportWidth >= DESKTOP_MIN_WIDTH ? "push" : "overlay"
  }

  function detectPageType(url = window.location.href) {
    const linkedinKind = window.EquipifyGrowthLinkedInContext?.detectLinkedInPageKind?.(url)
    if (linkedinKind === "profile" || linkedinKind === "company") return linkedinKind
    try {
      const path = new URL(url).pathname.replace(/\/+$/, "")
      if (/^\/search\//i.test(path)) return "search"
    } catch {
      // ignore
    }
    return linkedinKind ?? "other"
  }

  function queryFirst(doc, selectors) {
    for (const selector of selectors) {
      const element = doc.querySelector(selector)
      if (element) return { element, selector }
    }
    return { element: null, selector: null }
  }

  function locateScaffold(doc) {
    const root = queryFirst(doc, SCAFFOLD_ROOT_SELECTORS)
    const main = queryFirst(doc, SCAFFOLD_MAIN_SELECTORS)
    const content = queryFirst(doc, SCAFFOLD_CONTENT_SELECTORS)
    return {
      root: root.element,
      rootSelector: root.selector,
      main: main.element,
      mainSelector: main.selector,
      content: content.element,
      contentSelector: content.selector,
    }
  }

  function isEligibleRail(node) {
    if (!isHtmlElement(node)) return false
    if (node.closest("nav, header, footer, .global-nav")) return false
    const rect = node.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) return true
    const tag = node.tagName?.toLowerCase()
    return (
      tag === "aside" ||
      node.classList.contains("scaffold-layout__aside") ||
      node.classList.contains("scaffold-layout__sidebar") ||
      node.classList.contains("right-rail")
    )
  }

  function locateRightRails(doc, scaffold) {
    const rails = []
    const seen = new Set()

    for (const selector of RIGHT_RAIL_SELECTORS) {
      doc.querySelectorAll(selector).forEach((node) => {
        if (!isHtmlElement(node) || seen.has(node)) return
        if (scaffold.root && !scaffold.root.contains(node) && !node.closest(".scaffold-layout, .scaffold-layout-container")) {
          return
        }
        if (!isEligibleRail(node)) return
        seen.add(node)
        rails.push({ node, selector })
      })
    }

    return rails
  }

  function describeTarget(node, selector) {
    if (!isHtmlElement(node)) return null
    const tag = node.tagName?.toLowerCase() ?? "node"
    const id = node.id ? `#${node.id}` : ""
    const classes = typeof node.className === "string" && node.className.trim()
      ? `.${node.className.trim().split(/\s+/).slice(0, 3).join(".")}`
      : ""
    return `${selector ?? tag}${id}${classes}`
  }

  function describeRect(node) {
    if (!isHtmlElement(node)) return null
    const rect = node.getBoundingClientRect()
    return {
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      left: Math.round(rect.left),
      top: Math.round(rect.top),
    }
  }

  function measureWidth(node) {
    if (!isHtmlElement(node)) return null
    return Math.round(node.getBoundingClientRect().width)
  }

  function isDebugLayoutEnabled() {
    try {
      if (window.localStorage?.getItem(DEBUG_STORAGE_KEY) === "true") return true
      return new URL(window.location.href).searchParams.get(DEBUG_STORAGE_KEY) === "true"
    } catch {
      return false
    }
  }

  function clearLayoutMarks(doc = document) {
    for (const attr of LAYOUT_MARK_ATTRS) {
      doc.querySelectorAll(`[${attr}="true"]`).forEach((node) => {
        node.removeAttribute(attr)
      })
    }
  }

  function markScaffold(scaffold, rails) {
    clearLayoutMarks(scaffold.root?.ownerDocument ?? document)
    if (isHtmlElement(scaffold.root)) scaffold.root.setAttribute("data-equipify-layout-root", "true")
    if (isHtmlElement(scaffold.main)) scaffold.main.setAttribute("data-equipify-layout-main", "true")
    if (isHtmlElement(scaffold.content)) scaffold.content.setAttribute("data-equipify-layout-content", "true")
    rails.forEach(({ node }) => {
      node.setAttribute("data-equipify-layout-rail", "true")
    })
  }

  function setLayoutVariables(open, mode, root = document.documentElement) {
    if (open && mode === "push") {
      root.style.setProperty(CSS_VAR_PANEL_WIDTH, `${SIDEBAR_WIDTH_PX}px`)
      root.style.setProperty(CSS_VAR_RIGHT_MARGIN, `${RIGHT_MARGIN_PX}px`)
      root.style.setProperty(
        CSS_VAR_MAIN_WIDTH,
        `calc(100vw - ${SIDEBAR_WIDTH_PX}px - ${RIGHT_MARGIN_PX}px)`,
      )
      return
    }
    root.style.removeProperty(CSS_VAR_PANEL_WIDTH)
    root.style.removeProperty(CSS_VAR_RIGHT_MARGIN)
    root.style.removeProperty(CSS_VAR_MAIN_WIDTH)
  }

  function setDesktopLayoutClasses(open, mode, doc = document) {
    const body = doc.body
    const html = doc.documentElement
    if (!body || !html) return

    const pushActive = open && mode === "push"
    body.classList.toggle(DESKTOP_LAYOUT_CLASS, pushActive)
    body.classList.toggle(DEBUG_LAYOUT_CLASS, pushActive && isDebugLayoutEnabled())
    html.classList.toggle(BODY_CLASS, open)
    body.classList.toggle(BODY_CLASS, open)
  }

  function buildLayoutPushPayload(input) {
    return {
      mode: input.mode,
      viewport_width: input.viewport_width,
      panel_width: SIDEBAR_WIDTH_PX,
      hidden_right_rail_selectors: input.hidden_right_rail_selectors ?? [],
      selected_main_container: input.selected_main_container,
      before_rect: input.before_rect,
      after_rect: input.after_rect,
      strategy: input.strategy ?? LAYOUT_STRATEGY,
      restored: input.restored ?? false,
      page_type: input.page_type,
      debug_enabled: input.debug_enabled ?? false,
    }
  }

  function applyLayoutReserve(open, options = {}) {
    const doc = options.document ?? document
    const viewportWidth = options.viewportWidth ?? window.innerWidth
    const pageUrl = options.pageUrl ?? window.location.href
    const mode = resolveLayoutMode(viewportWidth)
    const page_type = detectPageType(pageUrl)
    const logLayoutPush = options.logLayoutPush ?? options.logLayoutDebug ?? (() => {})
    const scaffold = locateScaffold(doc)
    const mainContainer = scaffold.main ?? scaffold.content ?? scaffold.root
    const before_rect = describeRect(mainContainer)

    if (!open) {
      clearLayoutMarks(doc)
      setDesktopLayoutClasses(false, mode, doc)
      setLayoutVariables(false, mode, doc.documentElement)
      logLayoutPush(
        buildLayoutPushPayload({
          mode: "closed",
          viewport_width: viewportWidth,
          hidden_right_rail_selectors: [],
          selected_main_container: describeTarget(scaffold.main, scaffold.mainSelector),
          before_rect,
          after_rect: describeRect(mainContainer),
          strategy: LAYOUT_STRATEGY,
          restored: true,
          page_type,
        }),
      )
      return { mode: "closed", page_type, restored: true }
    }

    setDesktopLayoutClasses(true, mode, doc)
    setLayoutVariables(true, mode, doc.documentElement)

    let hidden_right_rail_selectors = []
    if (mode === "push") {
      const rails = locateRightRails(doc, scaffold)
      markScaffold(scaffold, rails)
      hidden_right_rail_selectors = rails.map(({ selector }) => selector)
    } else {
      clearLayoutMarks(doc)
    }

    const payload = buildLayoutPushPayload({
      mode,
      viewport_width: viewportWidth,
      hidden_right_rail_selectors,
      selected_main_container: describeTarget(scaffold.main, scaffold.mainSelector),
      before_rect,
      after_rect: describeRect(mainContainer),
      strategy: LAYOUT_STRATEGY,
      restored: false,
      page_type,
      debug_enabled: isDebugLayoutEnabled(),
    })

    logLayoutPush(payload)
    return { ...payload, page_type }
  }

  window.EquipifyGrowthLayoutPush = {
    BODY_CLASS,
    DESKTOP_LAYOUT_CLASS,
    DEBUG_LAYOUT_CLASS,
    DEBUG_STORAGE_KEY,
    LAYOUT_STRATEGY,
    SIDEBAR_WIDTH_PX,
    RIGHT_MARGIN_PX,
    DESKTOP_MIN_WIDTH,
    SCAFFOLD_ROOT_SELECTORS,
    SCAFFOLD_MAIN_SELECTORS,
    SCAFFOLD_CONTENT_SELECTORS,
    RIGHT_RAIL_SELECTORS,
    resolveLayoutMode,
    detectPageType,
    locateScaffold,
    locateRightRails,
    isDebugLayoutEnabled,
    applyLayoutReserve,
    setLayoutVariables,
    setDesktopLayoutClasses,
    clearLayoutMarks,
    measureWidth,
    describeRect,
  }
})()
