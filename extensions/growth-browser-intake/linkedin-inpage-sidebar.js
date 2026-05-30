/**
 * Equipify Sales in-page LinkedIn sidebar — Prospeo-style docked panel via content script.
 */
;(function initEquipifySalesInpageSidebar() {
  const SIDEBAR_ROOT_ID = "equipify-sales-inpage-sidebar-root"
  const SIDEBAR_WIDTH_PX = 420
  const BODY_CLASS = "equipify-sales-inpage-sidebar-open"
  const DOCK_OFFSET_CLASS = "equipify-sales-floating-dock--sidebar-open"
  const IFRAME_URL = chrome.runtime.getURL("inpage-sidebar.html")

  let rootNode = null
  let iframeNode = null
  let isOpen = false

  function pageKindSupported() {
    const ctx = window.EquipifyGrowthLinkedInContext
    if (!ctx) return false
    const kind = ctx.detectLinkedInPageKind(window.location.href)
    return kind === "profile" || kind === "company"
  }

  function logError(scope, error, details = {}) {
    const message = error instanceof Error ? error.message : String(error ?? "unknown")
    console.error("[Equipify Sales:inpage-sidebar]", scope, message, details, error)
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

    panel.appendChild(iframeNode)
    rootNode.appendChild(panel)
    document.documentElement.appendChild(rootNode)
    return rootNode
  }

  function buildPageContext() {
    return {
      metadata: window.__equipifyGrowthExtract?.() ?? null,
      visiblePeople: window.__equipifyGrowthLinkedInCompanyPeople?.() ?? [],
      tabUrl: window.location.href,
    }
  }

  function sendContextToIframe() {
    if (!iframeNode?.contentWindow) return
    iframeNode.contentWindow.postMessage(
      {
        type: "equipify-inpage-context",
        ...buildPageContext(),
      },
      "*",
    )
  }

  function setDockOffset(open) {
    document
      .getElementById("equipify-sales-linkedin-floating-dock")
      ?.classList.toggle(DOCK_OFFSET_CLASS, open)
    document.dispatchEvent(new CustomEvent("equipify-sidebar-state", { detail: { open } }))
  }

  function applyOpenState(open) {
    isOpen = open
    ensureRoot()
    rootNode.hidden = !open
    rootNode.setAttribute("aria-hidden", open ? "false" : "true")
    document.documentElement.classList.toggle(BODY_CLASS, open)
    document.body?.classList.toggle(BODY_CLASS, open)
    setDockOffset(open)

    if (open && iframeNode?.contentWindow) {
      sendContextToIframe()
    }
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
      sendContextToIframe()
    }
    if (event.data?.type === "equipify-inpage-sidebar-ready") {
      sendContextToIframe()
    }
  })

  window.addEventListener("popstate", () => {
    if (isOpen) sendContextToIframe()
  })
  window.addEventListener("hashchange", () => {
    if (isOpen) sendContextToIframe()
  })

  let lastContextUrl = null
  const contextObserver = new MutationObserver(() => {
    const current = window.location.href
    if (current !== lastContextUrl) {
      lastContextUrl = current
      if (isOpen) sendContextToIframe()
    }
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
