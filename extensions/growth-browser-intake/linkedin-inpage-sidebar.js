/**
 * Equipify Sales in-page LinkedIn sidebar — Prospeo-style docked panel via content script.
 */
;(function initEquipifySalesInpageSidebar() {
  const SIDEBAR_ROOT_ID = "equipify-sales-inpage-sidebar-root"
  const SIDEBAR_WIDTH_PX = 420
  const PANEL_WIDTH_VAR = "--equipify-sales-panel-width"
  const BODY_CLASS = "equipify-sales-panel-open"
  const DOCK_OFFSET_CLASS = "equipify-sales-floating-dock--sidebar-open"
  const LAYOUT_RESERVE_SELECTORS = [
    "body",
    "#voyager-feed",
    ".application-outlet",
    ".authentication-outlet",
    ".scaffold-layout",
    ".scaffold-layout__inner",
    ".scaffold-layout__main",
    "main.scaffold-layout__main",
    "#main-content",
    "main",
    ".global-nav + main",
    "[data-view-name='profile-page']",
    "[data-view-name='organization-page']",
    ".authentication-outlet > div",
    ".application-outlet > div",
  ]
  const TRANSFORM_SELECTORS = [
    ".scaffold-layout__inner",
    ".scaffold-layout__main",
    "main.scaffold-layout__main",
    "#main-content",
    "main",
    ".application-outlet",
  ]
  const IFRAME_URL = chrome.runtime.getURL("inpage-sidebar.html")
  const CONTEXT_DEBOUNCE_MS = 250
  const LAYOUT_LOG_PREFIX = "[Equipify Sales:layout]"

  let rootNode = null
  let iframeNode = null
  let isOpen = false
  let contextDebounceTimer = null
  let lastPostedContextKey = null
  let lastShiftedNodes = []

  function pageKindSupported() {
    const ctx = window.EquipifyGrowthLinkedInContext
    if (!ctx) return false
    const kind = ctx.detectLinkedInPageKind(window.location.href)
    return kind === "profile" || kind === "company"
  }

  function logInfo(scope, details = {}) {
    console.log("[Equipify Sales:inpage]", scope, details)
  }

  function logLayout(scope, details = {}) {
    console.log(LAYOUT_LOG_PREFIX, scope, details)
  }

  function logError(scope, error, details = {}) {
    const message = error instanceof Error ? error.message : String(error ?? "unknown")
    console.error("[Equipify Sales:inpage]", scope, message, details, error)
  }

  function isDesktopPushLayout() {
    return window.matchMedia("(min-width: 901px)").matches
  }

  function readInlineStyle(node, prop) {
    return node instanceof HTMLElement ? node.style.getPropertyValue(prop) || null : null
  }

  function ensureRoot() {
    if (rootNode?.isConnected) return rootNode

    rootNode = document.createElement("div")
    rootNode.id = SIDEBAR_ROOT_ID
    rootNode.className = "equipify-sales-inpage-sidebar-root"
    rootNode.hidden = true
    rootNode.setAttribute("aria-hidden", "true")

    const panel = document.createElement("div")
    panel.className = "equipify-sales-inpage-sidebar-panel"

    iframeNode = document.createElement("iframe")
    iframeNode.className = "equipify-sales-inpage-sidebar-frame"
    iframeNode.src = IFRAME_URL
    iframeNode.title = "Equipify Sales"
    iframeNode.setAttribute("allow", "clipboard-write")
    iframeNode.addEventListener("load", () => {
      logInfo("iframe_load")
      queueContextPost({ force: true })
    })

    panel.appendChild(iframeNode)
    rootNode.appendChild(panel)
    document.documentElement.appendChild(rootNode)
    return rootNode
  }

  function buildPageContext() {
    let metadata = null
    try {
      metadata = window.__equipifyGrowthExtract?.() ?? null
      logInfo("context_extract", {
        hasMetadata: Boolean(metadata),
        contact: metadata?.contact_name ?? null,
        headline: metadata?.headline ?? null,
        company: metadata?.company_name ?? null,
      })
    } catch (error) {
      logError("context_extract_failed", error)
    }

    return {
      metadata,
      visiblePeople: window.__equipifyGrowthLinkedInCompanyPeople?.() ?? [],
      tabUrl: window.location.href,
    }
  }

  function contextCacheKey(context) {
    const meta = context?.metadata ?? {}
    return [
      context?.tabUrl ?? "",
      meta.contact_name ?? "",
      meta.headline ?? "",
      meta.company_name ?? "",
      meta.website ?? "",
      Array.isArray(context?.visiblePeople) ? context.visiblePeople.length : 0,
    ].join("|")
  }

  function postContextToIframe(context) {
    if (!iframeNode?.contentWindow) return false
    iframeNode.contentWindow.postMessage(
      {
        type: "equipify-inpage-context",
        ...context,
      },
      "*",
    )
    lastPostedContextKey = contextCacheKey(context)
    logInfo("context_posted", {
      tabUrl: context.tabUrl,
      hasMetadata: Boolean(context.metadata),
      contact: context.metadata?.contact_name ?? null,
      company: context.metadata?.company_name ?? null,
    })
    return true
  }

  function queueContextPost(options = {}) {
    if (contextDebounceTimer) window.clearTimeout(contextDebounceTimer)
    contextDebounceTimer = window.setTimeout(() => {
      contextDebounceTimer = null
      const context = buildPageContext()
      const key = contextCacheKey(context)
      if (!options.force && key === lastPostedContextKey) return
      postContextToIframe(context)
    }, options.force ? 0 : CONTEXT_DEBOUNCE_MS)
  }

  function setDockOffset(open) {
    document
      .getElementById("equipify-sales-linkedin-floating-dock")
      ?.classList.toggle(DOCK_OFFSET_CLASS, open)
    document.dispatchEvent(new CustomEvent("equipify-sidebar-state", { detail: { open } }))
  }

  function restoreShiftedNode(entry) {
    const node = entry.node
    if (!(node instanceof HTMLElement)) return
    node.style.marginRight = entry.prev.marginRight ?? ""
    node.style.maxWidth = entry.prev.maxWidth ?? ""
    node.style.width = entry.prev.width ?? ""
    node.style.transform = entry.prev.transform ?? ""
    delete node.dataset.equipifySidebarReserve
  }

  function clearLayoutReserve() {
    for (const entry of lastShiftedNodes) restoreShiftedNode(entry)
    lastShiftedNodes = []
    document.documentElement.style.marginRight = ""
    document.body.style.marginRight = ""
    document.documentElement.style.removeProperty(PANEL_WIDTH_VAR)
  }

  function snapshotNodeStyles(node) {
    return {
      marginRight: readInlineStyle(node, "margin-right"),
      maxWidth: readInlineStyle(node, "max-width"),
      width: readInlineStyle(node, "width"),
      transform: readInlineStyle(node, "transform"),
    }
  }

  function describeShiftedNode(node, selector, strategy) {
    const computed = window.getComputedStyle(node)
    return {
      strategy,
      selector,
      tag: node.tagName.toLowerCase(),
      id: node.id || null,
      className: node.className?.toString?.().slice(0, 120) ?? null,
      computedWidth: computed.width,
      computedMarginRight: computed.marginRight,
      computedTransform: computed.transform,
    }
  }

  function applyLayoutReserve(open) {
    clearLayoutReserve()

    if (!open || !isDesktopPushLayout()) {
      logLayout("reserve_cleared", { open, desktop: isDesktopPushLayout(), shifted: [] })
      return
    }

    const shifted = []
    const seen = new Set()
    const width = `${SIDEBAR_WIDTH_PX}px`
    const widthCalc = `calc(100vw - ${width})`

    document.documentElement.style.setProperty(PANEL_WIDTH_VAR, width)
    document.documentElement.style.marginRight = width
    if (document.body) document.body.style.marginRight = width

    for (const selector of LAYOUT_RESERVE_SELECTORS) {
      document.querySelectorAll(selector).forEach((node) => {
        if (!(node instanceof HTMLElement)) return
        if (seen.has(node)) return
        if (node.closest(`#${SIDEBAR_ROOT_ID}`)) return

        seen.add(node)
        const prev = snapshotNodeStyles(node)
        node.dataset.equipifySidebarReserve = "true"
        node.style.marginRight = width
        node.style.maxWidth = widthCalc
        shifted.push({
          node,
          prev,
          meta: describeShiftedNode(node, selector, "margin"),
        })
      })
    }

    for (const selector of TRANSFORM_SELECTORS) {
      document.querySelectorAll(selector).forEach((node) => {
        if (!(node instanceof HTMLElement)) return
        if (seen.has(node)) return
        if (node.closest(`#${SIDEBAR_ROOT_ID}`)) return

        seen.add(node)
        const prev = snapshotNodeStyles(node)
        node.dataset.equipifySidebarReserve = "true"
        node.style.transform = `translateX(calc(-1 * ${width}))`
        node.style.maxWidth = widthCalc
        shifted.push({
          node,
          prev,
          meta: describeShiftedNode(node, selector, "transform"),
        })
      })
    }

    lastShiftedNodes = shifted
    logLayout("reserve_applied", {
      width,
      panelWidthVar: width,
      htmlMarginRight: document.documentElement.style.marginRight,
      bodyMarginRight: document.body?.style.marginRight ?? null,
      shifted: shifted.map((entry) => entry.meta),
    })
  }

  function applyOpenState(open) {
    isOpen = open
    ensureRoot()
    rootNode.hidden = !open
    rootNode.setAttribute("aria-hidden", open ? "false" : "true")

    document.documentElement.classList.toggle(BODY_CLASS, open)
    document.body?.classList.toggle(BODY_CLASS, open)

    if (!open) {
      document.documentElement.classList.remove(BODY_CLASS)
      document.body?.classList.remove(BODY_CLASS)
    }

    applyLayoutReserve(open)
    setDockOffset(open)

    if (open) queueContextPost({ force: true })
    else clearLayoutReserve()
  }

  function open() {
    if (!pageKindSupported()) {
      logError("unsupported_page", "Not a LinkedIn profile/company page", { url: window.location.href })
      return false
    }
    applyOpenState(true)
    return true
  }

  function close() {
    applyOpenState(false)
  }

  function toggle() {
    if (isOpen) {
      close()
      return false
    }
    return open()
  }

  window.EquipifySalesInpageSidebar = {
    open,
    close,
    toggle,
    isOpen: () => isOpen,
    SIDEBAR_WIDTH_PX,
    BODY_CLASS,
    LAYOUT_RESERVE_SELECTORS,
    TRANSFORM_SELECTORS,
    applyLayoutReserve,
    clearLayoutReserve,
  }

  window.addEventListener("message", (event) => {
    if (event.source !== iframeNode?.contentWindow) return
    if (event.data?.type === "equipify-inpage-sidebar-close") close()
    if (event.data?.type === "equipify-inpage-sidebar-refresh") {
      lastPostedContextKey = null
      queueContextPost({ force: true })
    }
    if (event.data?.type === "equipify-inpage-sidebar-ready") {
      queueContextPost({ force: true })
    }
  })

  window.addEventListener("popstate", () => {
    lastPostedContextKey = null
    if (isOpen) queueContextPost({ force: true })
  })
  window.addEventListener("hashchange", () => {
    lastPostedContextKey = null
    if (isOpen) queueContextPost({ force: true })
  })

  window.addEventListener("resize", () => {
    if (isOpen) applyLayoutReserve(true)
  })

  let lastContextUrl = window.location.href
  const contextObserver = new MutationObserver(() => {
    const current = window.location.href
    if (current === lastContextUrl) return
    lastContextUrl = current
    lastPostedContextKey = null
    if (isOpen) queueContextPost({ force: true })
  })
  contextObserver.observe(document.documentElement, { subtree: true, childList: true })

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "equipify-open-inpage-sidebar") {
      const ok = open()
      sendResponse({ ok })
      return true
    }
    if (message?.type === "equipify-close-inpage-sidebar") {
      close()
      sendResponse({ ok: true })
      return true
    }
    if (message?.type === "equipify-toggle-inpage-sidebar") {
      const ok = toggle()
      sendResponse({ ok, open: isOpen })
      return true
    }
    return undefined
  })
})()
