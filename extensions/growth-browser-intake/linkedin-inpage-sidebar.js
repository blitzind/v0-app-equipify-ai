/**
 * Equipify Sales in-page LinkedIn sidebar — Prospeo-style docked panel via content script.
 */
console.log("[Equipify Sales] linkedin-inpage-sidebar start")
;(function initEquipifySalesInpageSidebar() {
  const layoutPush = window.EquipifyGrowthLayoutPush
  const SIDEBAR_ROOT_ID = "equipify-sales-inpage-sidebar-root"
  const SIDEBAR_WIDTH_PX = layoutPush?.SIDEBAR_WIDTH_PX ?? 420
  const BODY_CLASS = layoutPush?.BODY_CLASS ?? "equipify-sales-inpage-sidebar-open"
  const DOCK_OFFSET_CLASS = "equipify-sales-floating-dock--sidebar-open"
  const IFRAME_URL = chrome.runtime.getURL("inpage-sidebar.html")
  const CONTEXT_DEBOUNCE_MS = 250

  let rootNode = null
  let iframeNode = null
  let isOpen = false
  let contextDebounceTimer = null
  let lastPostedContextKey = null

  function pageKindSupported() {
    const ctx = window.EquipifyGrowthLinkedInContext
    if (!ctx) return false
    const kind = ctx.detectLinkedInPageKind(window.location.href)
    return kind === "profile" || kind === "company"
  }

  function logInfo(scope, details = {}) {
    console.log("[Equipify Sales:inpage]", scope, details)
  }

  function logError(scope, error, details = {}) {
    const message = error instanceof Error ? error.message : String(error ?? "unknown")
    console.error("[Equipify Sales:inpage]", scope, message, details, error)
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
    panel.style.width = `${SIDEBAR_WIDTH_PX}px`

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
    console.log("[Equipify Sales:inpage]", "sidebar_context_posted", {
      tabUrl: context.tabUrl,
      hasMetadata: Boolean(context.metadata),
      contact: context.metadata?.contact_name ?? null,
      company: context.metadata?.company_name ?? null,
      profilePhoto: Boolean(context.metadata?.profile_photo_url),
    })
    logInfo("context_posted", { tabUrl: context.tabUrl, hasMetadata: Boolean(context.metadata) })
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

  function logLayoutPush(payload) {
    console.log("[Equipify Sales:layout-push]", payload)
  }

  function logLayoutDom(payload) {
    console.log("[Equipify Sales:layout-dom]", payload)
  }

  async function readPushLinkedInContentSetting() {
    try {
      const storage = window.EquipifyGrowthExtensionStorage
      if (storage?.loadExtensionSettings) {
        const settings = await storage.loadExtensionSettings()
        return settings.pushLinkedInContent === true
      }
      const stored = await chrome.storage.sync.get("equipifyGrowthExtensionSettings")
      const settings = stored?.equipifyGrowthExtensionSettings
      return settings?.pushLinkedInContent === true
    } catch {
      return false
    }
  }

  function applyLayoutReserve(open) {
    void readPushLinkedInContentSetting().then((pushEnabled) => {
      layoutPush?.applyLayoutReserve?.(open, {
        pageUrl: window.location.href,
        pushEnabled,
        logLayoutPush,
        logLayoutDom,
      })
    })
  }

  function applyOpenState(open) {
    isOpen = open
    ensureRoot()
    rootNode.hidden = !open
    rootNode.setAttribute("aria-hidden", open ? "false" : "true")
    applyLayoutReserve(open)
    setDockOffset(open)

    if (open) queueContextPost({ force: true })
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
