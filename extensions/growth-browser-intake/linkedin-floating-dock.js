/**
 * Equipify Sales LinkedIn floating dock — Prospeo-style right-edge launcher.
 * Visible metadata + Growth Engine lookup only. Operator can drag, hide, and reopen from settings.
 */
;(function initEquipifyLinkedInFloatingDock() {
  const storage = window.EquipifyGrowthExtensionStorage
  const config = window.EquipifyGrowthExtensionConfig
  const linkedinContext = window.EquipifyGrowthLinkedInContext
  const linkedinStatus = window.EquipifyGrowthLinkedInStatus
  const lookupCache = window.EquipifyGrowthExtensionLookupCache

  if (!storage || !config || !linkedinContext || !linkedinStatus) {
    console.error("[Equipify Sales:dock] missing content-script dependencies")
    return
  }

  const DOCK_ID = "equipify-sales-linkedin-floating-dock"
  const LOGO_URL = chrome.runtime.getURL("assets/equipify-sales-logo.png")
  const REFRESH_DEBOUNCE_MS = 300
  const NAV_THROTTLE_MS = 500
  const DEFAULT_TOP_PX = 180
  const MIN_TOP_PX = 72
  const BOTTOM_MARGIN_PX = 24

  let refreshTimer = null
  let lastUrl = null
  let lastNavCheck = 0
  let lastRenderKey = null
  let dockNode = null
  let latestPayload = null
  let dockPrefs = { ...storage.DEFAULT_LINKEDIN_FLOATING_DOCK }
  let dragging = false
  let dragOffsetY = 0

  function defaultPayload() {
    return {
      ok: true,
      matched: false,
      context: null,
      status_badge: "not_added",
      status_badge_label: "Not In Equipify",
    }
  }

  function logError(scope, error, details = {}) {
    const message = error instanceof Error ? error.message : String(error ?? "unknown")
    console.error("[Equipify Sales:dock]", scope, message, details, error)
  }

  function pageKindSupported() {
    const kind = linkedinContext.detectLinkedInPageKind(window.location.href)
    return kind === "profile" || kind === "company"
  }

  function removeDock() {
    document.getElementById(DOCK_ID)?.remove()
    dockNode = null
    lastRenderKey = null
  }

  async function loadPrefs() {
    dockPrefs = await storage.loadLinkedInFloatingDockPrefs()
    return dockPrefs
  }

  async function savePrefs(nextPrefs) {
    dockPrefs = {
      ...dockPrefs,
      ...nextPrefs,
    }
    await storage.saveLinkedInFloatingDockPrefs(dockPrefs)
  }

  function buildLookupParams() {
    const extracted = window.__equipifyGrowthExtract?.() ?? {}
    const query = linkedinContext.buildLinkedInLookupQuery({
      url: window.location.href,
      page_title: document.title,
      company_name: extracted.company_name,
      website: extracted.website,
      linkedin_url: extracted.linkedin_url,
      email: null,
    })

    const params = new URLSearchParams()
    if (query.linkedin_url) params.set("linkedin_url", query.linkedin_url)
    if (query.company_name) params.set("company_name", query.company_name)
    if (query.website) params.set("website", query.website)
    if (query.email) params.set("email", query.email)
    if (window.location.href) params.set("source_url", window.location.href)
    return params
  }

  async function fetchCrmContext(options = {}) {
    const params = buildLookupParams()
    if ([...params.keys()].length === 0) return null

    const settings = await storage.loadExtensionSettings()
    const baseUrl = settings.apiBaseUrl || config.EXTENSION_API_PRESETS.production
    const cacheKey = lookupCache?.buildKey?.(lookupCache.PREFIX.crmContext, params)

    if (!options.bypassCache && cacheKey) {
      const cached = lookupCache.read(cacheKey)
      if (cached !== null) return cached
    }

    const response = await fetch(`${baseUrl}${config.CRM_CONTEXT_PATH}?${params.toString()}`, {
      method: "GET",
      credentials: "include",
    })
    const body = await response.json().catch(() => null)
    if (!response.ok || !body?.ok) return null
    if (cacheKey) lookupCache?.write?.(cacheKey, body)
    return body
  }

  function openSidebar() {
    if (window.EquipifySalesInpageSidebar?.open?.()) return
    chrome.runtime.sendMessage({ type: "equipify-open-inpage-sidebar" }).catch(() => {})
  }

  function clampTopPx(topPx) {
    const dockHeight = dockNode?.offsetHeight ?? 96
    const maxTop = Math.max(MIN_TOP_PX, window.innerHeight - dockHeight - BOTTOM_MARGIN_PX)
    return Math.min(Math.max(topPx, MIN_TOP_PX), maxTop)
  }

  function applyDockPosition(topPx) {
    if (!dockNode) return
    const resolvedTop = clampTopPx(topPx ?? dockPrefs.topPx ?? DEFAULT_TOP_PX)
    dockNode.style.top = `${resolvedTop}px`
  }

  function statusToneFromPayload(payload) {
    const display = linkedinStatus.resolveProspectDisplayBadge(payload)
    return display.tone ?? "neutral"
  }

  function buildRenderKey(payload) {
    const display = linkedinStatus.resolveProspectDisplayBadge(payload)
    return [
      display.key,
      payload?.matched ? "matched" : "unmatched",
      dockPrefs.enabled ? "on" : "off",
      dockPrefs.topPx ?? "default",
    ].join("|")
  }

  function onDragMove(event) {
    if (!dragging || !dockNode) return
    const nextTop = clampTopPx(event.clientY - dragOffsetY)
    dockNode.style.top = `${nextTop}px`
  }

  async function onDragEnd() {
    if (!dragging || !dockNode) return
    dragging = false
    document.removeEventListener("mousemove", onDragMove)
    document.removeEventListener("mouseup", onDragEnd)
    const topPx = clampTopPx(parseFloat(dockNode.style.top) || DEFAULT_TOP_PX)
    dockNode.style.top = `${topPx}px`
    await savePrefs({ topPx })
  }

  function startDrag(event) {
    if (!dockNode) return
    event.preventDefault()
    event.stopPropagation()
    dragging = true
    dragOffsetY = event.clientY - dockNode.getBoundingClientRect().top
    document.addEventListener("mousemove", onDragMove)
    document.addEventListener("mouseup", onDragEnd)
  }

  async function hideDock() {
    await savePrefs({ enabled: false })
    removeDock()
  }

  function createDock(payload) {
    const display = linkedinStatus.resolveProspectDisplayBadge(payload)
    const tone = statusToneFromPayload(payload)

    const dock = document.createElement("div")
    dock.id = DOCK_ID
    dock.className = "equipify-sales-floating-dock"
    dock.setAttribute("role", "complementary")
    dock.setAttribute("aria-label", "Equipify Sales")

    const stack = document.createElement("div")
    stack.className = "equipify-sales-floating-dock__stack"

    const mainBtn = document.createElement("button")
    mainBtn.type = "button"
    mainBtn.className = "equipify-sales-floating-dock__main"
    mainBtn.title = display.matchSummary
      ? `${display.displayLabel} — ${display.matchSummary}. Open Equipify Sales.`
      : `${display.displayLabel}. Open Equipify Sales.`
    mainBtn.dataset.tone = tone

    const logo = document.createElement("img")
    logo.className = "equipify-sales-floating-dock__logo"
    logo.src = LOGO_URL
    logo.alt = "Equipify Sales"
    logo.width = 28
    logo.height = 28

    const statusDot = document.createElement("span")
    statusDot.className = "equipify-sales-floating-dock__status"
    statusDot.dataset.tone = tone
    statusDot.title = display.displayLabel
    statusDot.setAttribute("aria-hidden", "true")

    mainBtn.appendChild(logo)
    mainBtn.appendChild(statusDot)
    mainBtn.addEventListener("click", (event) => {
      event.preventDefault()
      event.stopPropagation()
      openSidebar()
    })

    const dragHandle = document.createElement("button")
    dragHandle.type = "button"
    dragHandle.className = "equipify-sales-floating-dock__drag"
    dragHandle.title = "Drag to move"
    dragHandle.setAttribute("aria-label", "Drag Equipify Sales button")
    dragHandle.innerHTML = '<span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span>'
    dragHandle.addEventListener("mousedown", startDrag)

    const mainWrap = document.createElement("div")
    mainWrap.className = "equipify-sales-floating-dock__main-wrap"
    mainWrap.appendChild(mainBtn)
    mainWrap.appendChild(dragHandle)

    const hideBtn = document.createElement("button")
    hideBtn.type = "button"
    hideBtn.className = "equipify-sales-floating-dock__hide"
    hideBtn.title = "Hide Equipify Sales button"
    hideBtn.setAttribute("aria-label", "Hide Equipify Sales button")
    hideBtn.innerHTML =
      '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M12 5c-5 0-9.3 3.1-10.7 7.5 1.4 4.4 5.7 7.5 10.7 7.5s9.3-3.1 10.7-7.5C21.3 8.1 17 5 12 5zm0 12.5a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"/><line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" stroke-width="2"/></svg>'
    hideBtn.addEventListener("click", (event) => {
      event.preventDefault()
      event.stopPropagation()
      hideDock().catch(() => removeDock())
    })

    stack.appendChild(mainWrap)
    stack.appendChild(hideBtn)
    dock.appendChild(stack)
    return dock
  }

  function renderDock(payload) {
    latestPayload = payload
    const renderKey = buildRenderKey(payload)
    if (renderKey === lastRenderKey && dockNode?.isConnected) {
      const tone = statusToneFromPayload(payload)
      const display = linkedinStatus.resolveProspectDisplayBadge(payload)
      const statusDot = dockNode.querySelector(".equipify-sales-floating-dock__status")
      const mainBtn = dockNode.querySelector(".equipify-sales-floating-dock__main")
      if (statusDot) {
        statusDot.dataset.tone = tone
        statusDot.title = display.displayLabel
      }
      if (mainBtn) {
        mainBtn.dataset.tone = tone
        mainBtn.title = display.matchSummary
          ? `${display.displayLabel} — ${display.matchSummary}. Open Equipify Sales.`
          : `${display.displayLabel}. Open Equipify Sales.`
      }
      return
    }

    removeDock()
    dockNode = createDock(payload)
    document.body.appendChild(dockNode)
    applyDockPosition(dockPrefs.topPx ?? DEFAULT_TOP_PX)
    lastRenderKey = renderKey
  }

  async function refreshDock(options = {}) {
    await loadPrefs()

    if (!dockPrefs.enabled || !pageKindSupported()) {
      removeDock()
      return
    }

    if (!dockNode) renderDock(defaultPayload())

    try {
      const payload = await fetchCrmContext(options)
      renderDock(payload ?? defaultPayload())
    } catch (error) {
      logError("refresh_dock_failed", error)
      renderDock(defaultPayload())
    }
  }

  function scheduleRefresh(bypassCache = false) {
    if (refreshTimer) window.clearTimeout(refreshTimer)
    refreshTimer = window.setTimeout(() => {
      refreshDock({ bypassCache }).catch(() => removeDock())
    }, REFRESH_DEBOUNCE_MS)
  }

  function watchNavigation() {
    const now = Date.now()
    if (now - lastNavCheck < NAV_THROTTLE_MS) return
    lastNavCheck = now

    const current = window.location.href
    if (current !== lastUrl) {
      lastUrl = current
      lastRenderKey = null
      scheduleRefresh()
    }
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[storage.LOCAL_STORAGE_KEYS.linkedInFloatingDock]) {
      const next = changes[storage.LOCAL_STORAGE_KEYS.linkedInFloatingDock].newValue
      dockPrefs = {
        ...storage.DEFAULT_LINKEDIN_FLOATING_DOCK,
        ...(next ?? {}),
      }
      lastRenderKey = null
      if (!dockPrefs.enabled) {
        removeDock()
        return
      }
      if (latestPayload) {
        renderDock(latestPayload)
      } else {
        scheduleRefresh(true)
      }
      return
    }

    if (area === "sync" && changes[storage.STORAGE_KEYS.settings]) {
      lastRenderKey = null
      scheduleRefresh(true)
    }
  })

  window.addEventListener(
    "resize",
    () => {
      if (dockNode) applyDockPosition(parseFloat(dockNode.style.top) || dockPrefs.topPx || DEFAULT_TOP_PX)
    },
    { passive: true },
  )

  const observer = new MutationObserver(() => watchNavigation())
  observer.observe(document.documentElement, { subtree: true, childList: true })
  window.addEventListener("popstate", () => scheduleRefresh())
  window.addEventListener("hashchange", () => scheduleRefresh())

  document.addEventListener("equipify-sidebar-state", (event) => {
    const open = event.detail?.open === true
    const dock = document.getElementById(DOCK_ID)
    if (dock) dock.classList.toggle("equipify-sales-floating-dock--sidebar-open", open)
  })

  lastUrl = window.location.href
  loadPrefs().finally(() => {
    refreshDock().catch(() => removeDock())
  })
})()
