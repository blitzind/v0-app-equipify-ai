/**
 * LinkedIn layout — overlay by default; optional body-padding push (v4.3.39).
 */
;(function initEquipifyGrowthLayoutPush() {
  const SIDEBAR_WIDTH_PX = 420
  const DESKTOP_MIN_WIDTH = 1200
  const BODY_CLASS = "equipify-sales-inpage-sidebar-open"
  const PUSH_MODE_CLASS = "equipify-layout-push-mode"
  const DEBUG_LAYOUT_CLASS = "equipify-layout-debug"
  const CSS_VAR_PANEL_WIDTH = "--equipify-panel-width"
  const DEBUG_STORAGE_KEY = "equipify_debug_layout"
  const LAYOUT_STRATEGY_OVERLAY = "overlay_fixed_panel"
  const LAYOUT_STRATEGY_PUSH = "push_body_padding_hide_rail"

  const RIGHT_RAIL_SELECTORS = [
    ".scaffold-layout__aside",
    ".scaffold-layout__sidebar",
    "aside.scaffold-layout__aside",
    ".scaffold-layout aside",
    ".right-rail",
  ]

  function isHtmlElement(node) {
    return Boolean(node && typeof node === "object" && node.nodeType === 1)
  }

  function resolveLayoutMode(viewportWidth = window.innerWidth, pushEnabled = false) {
    if (!pushEnabled) return "overlay"
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
    const root = queryFirst(doc, [".scaffold-layout", ".scaffold-layout-container", ".application-outlet"])
    const inner = queryFirst(doc, [".scaffold-layout__inner"])
    const main = queryFirst(doc, [
      ".scaffold-layout__main",
      "main.scaffold-layout__main",
      'main[role="main"]',
    ])
    const content = queryFirst(doc, [".scaffold-layout__content", "#main-content"])
    return {
      root: root.element,
      rootSelector: root.selector,
      inner: inner.element,
      innerSelector: inner.selector,
      main: main.element,
      mainSelector: main.selector,
      content: content.element,
      contentSelector: content.selector,
    }
  }

  function locateFeed(doc, scaffold) {
    const scope = scaffold.main ?? scaffold.content ?? scaffold.root ?? doc
    const selectors = [
      '[data-view-name="feed-container"]',
      ".scaffold-finite-scroll__content",
      ".scaffold-finite-scroll",
    ]
    for (const selector of selectors) {
      const element = scope.querySelector?.(selector) ?? doc.querySelector(selector)
      if (element) return { element, selector }
    }
    return { element: null, selector: null }
  }

  function locateRightRails(doc) {
    const rails = []
    const seen = new Set()
    for (const selector of RIGHT_RAIL_SELECTORS) {
      doc.querySelectorAll(selector).forEach((node) => {
        if (!isHtmlElement(node) || seen.has(node)) return
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
    return `${selector ?? tag}${id}`
  }

  function describeRect(node) {
    if (!isHtmlElement(node)) return null
    const rect = node.getBoundingClientRect()
    return {
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      left: Math.round(rect.left),
      right: Math.round(rect.right),
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
    doc.querySelectorAll('[data-equipify-layout-rail="true"]').forEach((node) => {
      node.removeAttribute("data-equipify-layout-rail")
    })
  }

  function markRightRails(rails) {
    rails.forEach(({ node }) => {
      node.setAttribute("data-equipify-layout-rail", "true")
    })
  }

  function setLayoutVariables(open, mode, root = document.documentElement) {
    if (open) {
      root.style.setProperty(CSS_VAR_PANEL_WIDTH, `${SIDEBAR_WIDTH_PX}px`)
      return
    }
    root.style.removeProperty(CSS_VAR_PANEL_WIDTH)
  }

  function setDesktopLayoutClasses(open, mode, doc = document) {
    const body = doc.body
    const html = doc.documentElement
    if (!body || !html) return

    const pushActive = open && mode === "push"
    body.classList.toggle(PUSH_MODE_CLASS, pushActive)
    body.classList.toggle(DEBUG_LAYOUT_CLASS, pushActive && isDebugLayoutEnabled())
    html.classList.toggle(BODY_CLASS, open)
    body.classList.toggle(BODY_CLASS, open)
  }

  function measurePushOverlap(doc, panelWidth = SIDEBAR_WIDTH_PX) {
    const main =
      doc.querySelector(".scaffold-layout__main") ??
      doc.querySelector('main[role="main"]') ??
      doc.querySelector("main")
    if (!isHtmlElement(main)) return 0
    const rect = main.getBoundingClientRect()
    const viewport = doc.defaultView?.innerWidth ?? window.innerWidth
    const panelLeft = viewport - panelWidth
    return Math.max(0, Math.round(rect.right - panelLeft))
  }

  function buildLayoutPushPayload(input) {
    return {
      mode: input.mode,
      viewport_width: input.viewport_width,
      panel_width: SIDEBAR_WIDTH_PX,
      push_enabled: input.push_enabled ?? false,
      hidden_right_rail_selectors: input.hidden_right_rail_selectors ?? [],
      selected_main_container: input.selected_main_container,
      before_rect: input.before_rect,
      after_rect: input.after_rect,
      overlap_px: input.overlap_px ?? null,
      strategy: input.strategy ?? LAYOUT_STRATEGY_OVERLAY,
      fallback_to_overlay: input.fallback_to_overlay ?? false,
      restored: input.restored ?? false,
      page_type: input.page_type,
      debug_enabled: input.debug_enabled ?? false,
    }
  }

  function inspectLayoutDom(doc, scaffold, feed, input = {}) {
    const anchor = scaffold.content ?? scaffold.main ?? scaffold.root
    return {
      page_type: input.page_type ?? null,
      scaffold: describeRect(scaffold.root),
      main: describeRect(scaffold.main),
      content: describeRect(scaffold.content),
      feed: describeRect(feed?.element),
      widths: {
        viewport: input.viewport_width ?? doc.defaultView?.innerWidth ?? null,
        reserved_panel: SIDEBAR_WIDTH_PX,
        scaffold: measureWidth(scaffold.root),
        main: measureWidth(scaffold.main),
        content: measureWidth(scaffold.content),
        feed: measureWidth(feed?.element),
      },
      anchor: describeTarget(anchor, null),
    }
  }

  function applyLayoutReserve(open, options = {}) {
    const doc = options.document ?? document
    const viewportWidth = options.viewportWidth ?? window.innerWidth
    const pageUrl = options.pageUrl ?? window.location.href
    const pushEnabled = options.pushEnabled === true
    let mode = resolveLayoutMode(viewportWidth, pushEnabled)
    const page_type = detectPageType(pageUrl)
    const logLayoutPush = options.logLayoutPush ?? options.logLayoutDebug ?? (() => {})
    const logLayoutDom = options.logLayoutDom ?? (() => {})
    const scaffold = locateScaffold(doc)
    const feed = locateFeed(doc, scaffold)
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
          push_enabled: pushEnabled,
          hidden_right_rail_selectors: [],
          selected_main_container: describeTarget(scaffold.main, scaffold.mainSelector),
          before_rect,
          after_rect: describeRect(mainContainer),
          strategy: LAYOUT_STRATEGY_OVERLAY,
          restored: true,
          page_type,
        }),
      )
      return { mode: "closed", page_type, restored: true, push_enabled: pushEnabled }
    }

    setLayoutVariables(true, mode, doc.documentElement)

    let hidden_right_rail_selectors = []
    let fallback_to_overlay = false
    let strategy = mode === "push" ? LAYOUT_STRATEGY_PUSH : LAYOUT_STRATEGY_OVERLAY

    if (mode === "push") {
      const rails = locateRightRails(doc)
      markRightRails(rails)
      hidden_right_rail_selectors = rails.map(({ selector }) => selector)
      setDesktopLayoutClasses(true, mode, doc)
      const overlap_px = measurePushOverlap(doc, SIDEBAR_WIDTH_PX)
      if (overlap_px > 24) {
        fallback_to_overlay = true
        mode = "overlay"
        strategy = LAYOUT_STRATEGY_OVERLAY
        clearLayoutMarks(doc)
        setDesktopLayoutClasses(true, mode, doc)
      }
    } else {
      clearLayoutMarks(doc)
      setDesktopLayoutClasses(true, mode, doc)
    }

    const payload = buildLayoutPushPayload({
      mode,
      viewport_width: viewportWidth,
      push_enabled: pushEnabled,
      hidden_right_rail_selectors,
      selected_main_container: describeTarget(scaffold.main, scaffold.mainSelector),
      before_rect,
      after_rect: describeRect(mainContainer),
      overlap_px: mode === "push" ? measurePushOverlap(doc, SIDEBAR_WIDTH_PX) : null,
      strategy,
      fallback_to_overlay,
      restored: false,
      page_type,
      debug_enabled: isDebugLayoutEnabled(),
    })

    logLayoutPush(payload)

    if (mode === "push") {
      logLayoutDom(
        inspectLayoutDom(doc, scaffold, feed, {
          page_type,
          viewport_width: viewportWidth,
        }),
      )
      window.EquipifyGrowthLayoutObserver?.observeLayout?.({
        document: doc,
        viewportWidth,
      })
    } else if (open) {
      window.EquipifyGrowthLayoutObserver?.observeLayout?.({
        document: doc,
        viewportWidth,
      })
    }

    return { ...payload, page_type }
  }

  window.EquipifyGrowthLayoutPush = {
    BODY_CLASS,
    PUSH_MODE_CLASS,
    DEBUG_LAYOUT_CLASS,
    DEBUG_STORAGE_KEY,
    LAYOUT_STRATEGY: LAYOUT_STRATEGY_PUSH,
    LAYOUT_STRATEGY_OVERLAY,
    LAYOUT_STRATEGY_PUSH,
    SIDEBAR_WIDTH_PX,
    DESKTOP_MIN_WIDTH,
    resolveLayoutMode,
    detectPageType,
    locateScaffold,
    locateFeed,
    locateRightRails,
    inspectLayoutDom,
    isDebugLayoutEnabled,
    applyLayoutReserve,
    setLayoutVariables,
    setDesktopLayoutClasses,
    clearLayoutMarks,
    measureWidth,
    describeRect,
    measurePushOverlap,
  }
})()
