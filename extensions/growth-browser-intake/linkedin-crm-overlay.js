/**
 * Equipify Sales LinkedIn status badge — visible metadata + Growth Engine lookup only.
 * Injects a profile-header badge within ~1–2s; click opens the side panel workspace.
 */
;(function initEquipifyLinkedInProfileBadge() {
  const storage = window.EquipifyGrowthExtensionStorage
  const config = window.EquipifyGrowthExtensionConfig
  const linkedinContext = window.EquipifyGrowthLinkedInContext
  const linkedinStatus = window.EquipifyGrowthLinkedInStatus
  const lookupCache = window.EquipifyGrowthExtensionLookupCache

  if (!storage || !config || !linkedinContext || !linkedinStatus) {
    console.error("[Equipify Sales:header-badge] missing content-script dependencies")
    return
  }

  const BADGE_ROOT_ID = "equipify-sales-linkedin-badge-root"
  const REFRESH_DEBOUNCE_MS = 300
  const NAV_THROTTLE_MS = 500
  const LOGO_URL = chrome.runtime.getURL("assets/equipify-lightning.png")

  let refreshTimer = null
  let lastUrl = null
  let lastNavCheck = 0
  let lastRenderKey = null
  let badgeRoot = null
  let prospectingMode = false
  let latestPayload = null

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
    console.error("[Equipify Sales:header-badge]", scope, message, details, error)
  }

  async function loadSettings() {
    const settings = await storage.loadExtensionSettings()
    prospectingMode = settings.prospectingMode === true
    return settings
  }

  function pageKind() {
    return linkedinContext.detectLinkedInPageKind(window.location.href)
  }

  function pageKindSupported() {
    const kind = pageKind()
    return kind === "profile" || kind === "company"
  }

  function removeBadge() {
    document.getElementById(BADGE_ROOT_ID)?.remove()
    badgeRoot = null
    lastRenderKey = null
    latestPayload = null
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

    const settings = await loadSettings()
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

  function findProfileBadgeAnchor() {
    const selectors = [
      "main section.artdeco-card div.ph5",
      "main .pv-text-details__left-panel",
      "main section.artdeco-card h1",
      "h1.text-heading-xlarge",
      "main h1",
      ".org-top-card-primary-content",
    ]

    for (const selector of selectors) {
      const el = document.querySelector(selector)
      if (el?.offsetParent !== null) return el
    }
    return null
  }

  function openSidebar() {
    if (window.EquipifySalesInpageSidebar?.open?.()) return
    chrome.runtime.sendMessage({ type: "equipify-open-inpage-sidebar" }).catch(() => {})
  }

  function buildRenderKey(payload) {
    const display = linkedinStatus.resolveProspectDisplayBadge(payload)
    return [
      display.key,
      payload?.matched ? "matched" : "unmatched",
      prospectingMode ? "scan" : "default",
      pageKind(),
    ].join("|")
  }

  function createBadgeButton(display) {
    const btn = document.createElement("button")
    btn.type = "button"
    btn.className = "equipify-sales-linkedin-badge"
    btn.dataset.tone = display.tone
    btn.dataset.scan = prospectingMode ? "true" : "false"
    btn.title = display.matchSummary
      ? `${display.displayLabel} — ${display.matchSummary}. Click to open Equipify Sales.`
      : `${display.displayLabel}. Click to open Equipify Sales.`

    const dot = document.createElement("span")
    dot.className = "equipify-sales-linkedin-badge__dot"
    dot.textContent = display.emoji
    dot.setAttribute("aria-hidden", "true")

    const logo = document.createElement("img")
    logo.className = "equipify-sales-linkedin-badge__logo"
    logo.src = LOGO_URL
    logo.alt = ""
    logo.width = 14
    logo.height = 14

    const label = document.createElement("span")
    label.className = "equipify-sales-linkedin-badge__label"
    label.textContent = display.displayLabel

    btn.appendChild(dot)
    btn.appendChild(logo)
    btn.appendChild(label)
    btn.addEventListener("click", (event) => {
      event.preventDefault()
      event.stopPropagation()
      openSidebar()
    })

    return btn
  }

  function ensureBadgeRoot() {
    let root = document.getElementById(BADGE_ROOT_ID)
    if (root?.isConnected) {
      badgeRoot = root
      return root
    }

    removeBadge()
    root = document.createElement("div")
    root.id = BADGE_ROOT_ID
    root.className = "equipify-sales-linkedin-badge-root"

    const anchor = findProfileBadgeAnchor()
    if (anchor?.parentElement) {
      anchor.parentElement.insertBefore(root, anchor.nextSibling)
    } else {
      root.classList.add("equipify-sales-linkedin-badge-root--floating")
      document.body.appendChild(root)
    }

    badgeRoot = root
    return root
  }

  function renderBadge(payload) {
    latestPayload = payload
    const renderKey = buildRenderKey(payload)
    if (renderKey === lastRenderKey && badgeRoot?.isConnected) return

    const display = linkedinStatus.resolveProspectDisplayBadge(payload)
    const root = ensureBadgeRoot()
    root.replaceChildren()

    root.appendChild(createBadgeButton(display))

    if (prospectingMode && display.key === "not_added") {
      const hint = document.createElement("span")
      hint.className = "equipify-sales-linkedin-badge__hint"
      hint.textContent = "Prospecting — not in CRM yet"
      root.appendChild(hint)
    }

    lastRenderKey = renderKey
  }

  function renderLoadingBadge() {
    const root = ensureBadgeRoot()
    if (root.querySelector(".equipify-sales-linkedin-badge--loading")) return

    root.replaceChildren()
    const btn = document.createElement("button")
    btn.type = "button"
    btn.className = "equipify-sales-linkedin-badge equipify-sales-linkedin-badge--loading"
    btn.dataset.tone = "neutral"
    btn.title = "Checking Equipify status…"

    const logo = document.createElement("img")
    logo.className = "equipify-sales-linkedin-badge__logo"
    logo.src = LOGO_URL
    logo.alt = ""
    logo.width = 14
    logo.height = 14

    const label = document.createElement("span")
    label.className = "equipify-sales-linkedin-badge__label"
    label.textContent = "Checking Equipify…"

    btn.appendChild(logo)
    btn.appendChild(label)
    btn.addEventListener("click", openSidebar)
    root.appendChild(btn)
  }

  async function refreshBadge(options = {}) {
    if (!pageKindSupported()) {
      removeBadge()
      return
    }

    if (!options.skipLoading) renderLoadingBadge()

    try {
      const payload = await fetchCrmContext(options)
      renderBadge(payload ?? defaultPayload())
    } catch (error) {
      logError("refresh_badge_failed", error)
      renderBadge(defaultPayload())
    }
  }

  function scheduleRefresh(bypassCache = false) {
    if (refreshTimer) window.clearTimeout(refreshTimer)
    refreshTimer = window.setTimeout(() => {
      refreshBadge({ bypassCache }).catch(() => removeBadge())
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
    if (area !== "sync" || !changes[storage.STORAGE_KEYS.settings]) return
    const next = changes[storage.STORAGE_KEYS.settings].newValue
    const nextMode = next?.prospectingMode === true
    if (nextMode !== prospectingMode) {
      prospectingMode = nextMode
      lastRenderKey = null
      if (latestPayload) renderBadge(latestPayload)
    }
  })

  const observer = new MutationObserver(() => watchNavigation())
  observer.observe(document.documentElement, { subtree: true, childList: true })
  window.addEventListener("popstate", () => scheduleRefresh())
  window.addEventListener("hashchange", () => scheduleRefresh())

  lastUrl = window.location.href
  loadSettings().finally(() => {
    refreshBadge({ skipLoading: false }).catch(() => removeBadge())
  })
})()
