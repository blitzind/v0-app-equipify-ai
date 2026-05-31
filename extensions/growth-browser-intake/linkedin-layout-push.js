/**
 * LinkedIn desktop layout push — CSS-class scaffold mode (v4.3.34).
 * Reserves viewport space for the Equipify panel without inline style hacks.
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

  const LAYOUT_MARK_ATTRS = [
    "data-equipify-layout-root",
    "data-equipify-layout-main",
    "data-equipify-layout-content",
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

  function describeTarget(node, selector) {
    if (!isHtmlElement(node)) return null
    const tag = node.tagName?.toLowerCase() ?? "node"
    const id = node.id ? `#${node.id}` : ""
    const classes = typeof node.className === "string" && node.className.trim()
      ? `.${node.className.trim().split(/\s+/).slice(0, 3).join(".")}`
      : ""
    return `${selector ?? tag}${id}${classes}`
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

  function markScaffold(scaffold) {
    clearLayoutMarks(scaffold.root?.ownerDocument ?? document)
    if (isHtmlElement(scaffold.root)) scaffold.root.setAttribute("data-equipify-layout-root", "true")
    if (isHtmlElement(scaffold.main)) scaffold.main.setAttribute("data-equipify-layout-main", "true")
    if (isHtmlElement(scaffold.content)) scaffold.content.setAttribute("data-equipify-layout-content", "true")
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

  function buildDebugPayload(input) {
    return {
      page_type: input.page_type,
      viewport_width: input.viewport_width,
      panel_width: SIDEBAR_WIDTH_PX,
      scaffold_width_before: input.scaffold_width_before,
      scaffold_width_after: input.scaffold_width_after,
      content_width_before: input.content_width_before,
      content_width_after: input.content_width_after,
      selected_root: input.selected_root,
      selected_main: input.selected_main,
      selected_content: input.selected_content,
      mode: input.mode,
      debug_enabled: input.debug_enabled,
    }
  }

  function applyLayoutReserve(open, options = {}) {
    const doc = options.document ?? document
    const viewportWidth = options.viewportWidth ?? window.innerWidth
    const pageUrl = options.pageUrl ?? window.location.href
    const mode = resolveLayoutMode(viewportWidth)
    const page_type = detectPageType(pageUrl)
    const logLayoutDebug = options.logLayoutDebug ?? (() => {})
    const scaffold = locateScaffold(doc)

    const scaffold_width_before = measureWidth(scaffold.root)
    const content_width_before = measureWidth(scaffold.content ?? scaffold.main)

    if (!open) {
      clearLayoutMarks(doc)
      setDesktopLayoutClasses(false, mode, doc)
      setLayoutVariables(false, mode, doc.documentElement)
      logLayoutDebug(
        buildDebugPayload({
          page_type,
          viewport_width: viewportWidth,
          scaffold_width_before,
          scaffold_width_after: measureWidth(scaffold.root),
          content_width_before,
          content_width_after: measureWidth(scaffold.content ?? scaffold.main),
          selected_root: describeTarget(scaffold.root, scaffold.rootSelector),
          selected_main: describeTarget(scaffold.main, scaffold.mainSelector),
          selected_content: describeTarget(scaffold.content, scaffold.contentSelector),
          mode: "closed",
          debug_enabled: false,
        }),
      )
      return { mode: "closed", page_type }
    }

    setDesktopLayoutClasses(true, mode, doc)
    setLayoutVariables(true, mode, doc.documentElement)

    if (mode === "push") {
      markScaffold(scaffold)
    } else {
      clearLayoutMarks(doc)
    }

    const payload = buildDebugPayload({
      page_type,
      viewport_width: viewportWidth,
      scaffold_width_before,
      scaffold_width_after: measureWidth(scaffold.root),
      content_width_before,
      content_width_after: measureWidth(scaffold.content ?? scaffold.main),
      selected_root: describeTarget(scaffold.root, scaffold.rootSelector),
      selected_main: describeTarget(scaffold.main, scaffold.mainSelector),
      selected_content: describeTarget(scaffold.content, scaffold.contentSelector),
      mode,
      debug_enabled: isDebugLayoutEnabled(),
    })

    logLayoutDebug(payload)
    return { mode, page_type, ...payload }
  }

  window.EquipifyGrowthLayoutPush = {
    BODY_CLASS,
    DESKTOP_LAYOUT_CLASS,
    DEBUG_LAYOUT_CLASS,
    DEBUG_STORAGE_KEY,
    SIDEBAR_WIDTH_PX,
    RIGHT_MARGIN_PX,
    DESKTOP_MIN_WIDTH,
    SCAFFOLD_ROOT_SELECTORS,
    SCAFFOLD_MAIN_SELECTORS,
    SCAFFOLD_CONTENT_SELECTORS,
    resolveLayoutMode,
    detectPageType,
    locateScaffold,
    isDebugLayoutEnabled,
    applyLayoutReserve,
    setLayoutVariables,
    setDesktopLayoutClasses,
    clearLayoutMarks,
    measureWidth,
  }
})()
