/**
 * Equipify Sales LinkedIn status badge — visible metadata + Growth Engine lookup only.
 * Injects a profile-header badge inline beside the profile/company name when possible.
 */
;(function initEquipifyLinkedInProfileBadge() {
  const storage = window.EquipifyGrowthExtensionStorage
  const config = window.EquipifyGrowthExtensionConfig
  const linkedinContext = window.EquipifyGrowthLinkedInContext
  const linkedinStatus = window.EquipifyGrowthLinkedInStatus
  const lookupCache = window.EquipifyGrowthExtensionLookupCache

  if (!storage || !config || !linkedinContext || !linkedinStatus) {
    console.error("[Equipify Sales:linkedin-badge] missing content-script dependencies")
    return
  }

  const BADGE_ROOT_ID = "equipify-sales-linkedin-badge-root"
  const REFRESH_DEBOUNCE_MS = 300
  const NAV_THROTTLE_MS = 500
  const LOOKUP_DEADLINE_MS = 5000
  const MOUNT_RETRY_MS = 5000
  const LOGO_URL =
    window.EquipifyGrowthExtensionBrand?.dockLogoUrl?.() ??
    chrome.runtime.getURL("assets/equipify-lightning.png")

  let refreshTimer = null
  let lookupDeadlineTimer = null
  let lastUrl = null
  let lastNavCheck = 0
  let lastRenderKey = null
  let badgeRoot = null
  let prospectingMode = false
  let latestPayload = null
  let mountRetryTimer = null
  let mountObserver = null
  let mountMode = "pending"
  let refreshGeneration = 0
  let lookupInFlight = false

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
    console.error("[Equipify Sales:linkedin-badge]", scope, message, details, error)
  }

  function logInfo(scope, details = {}) {
    console.log("[Equipify Sales:linkedin-badge]", scope, details)
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

  function clearLookupDeadline() {
    if (lookupDeadlineTimer) window.clearTimeout(lookupDeadlineTimer)
    lookupDeadlineTimer = null
  }

  function removeBadge() {
    clearLookupDeadline()
    if (mountRetryTimer) window.clearTimeout(mountRetryTimer)
    mountRetryTimer = null
    mountObserver?.disconnect()
    mountObserver = null
    mountMode = "pending"
    document.getElementById(BADGE_ROOT_ID)?.remove()
    badgeRoot = null
    lastRenderKey = null
    latestPayload = null
    lookupInFlight = false
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

    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), LOOKUP_DEADLINE_MS)
    try {
      const response = await fetch(`${baseUrl}${config.CRM_CONTEXT_PATH}?${params.toString()}`, {
        method: "GET",
        credentials: "include",
        signal: controller.signal,
      })
      const body = await response.json().catch(() => null)
      if (response.status === 403) {
        return {
          ...defaultPayload(),
          error_status: 403,
          message: body?.message ?? "Not authorized for Growth Engine CRM lookup.",
        }
      }
      if (!response.ok || !body?.ok) {
        return {
          ...defaultPayload(),
          error_status: response.status || 0,
          error: body?.error ?? "crm_context_failed",
          message: body?.message ?? "CRM lookup failed. Click to retry.",
        }
      }
      if (cacheKey) lookupCache?.write?.(cacheKey, body)
      return body
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "AbortError"
      return {
        ...defaultPayload(),
        error_status: timedOut ? 408 : 0,
        error: timedOut ? "crm_context_timeout" : "crm_context_failed",
        message: timedOut ? "CRM lookup timed out. Click to retry." : "CRM lookup failed. Click to retry.",
      }
    } finally {
      window.clearTimeout(timeoutId)
    }
  }

  function findProfileNameElement() {
    const selectors = [
      "main h1.text-heading-xlarge",
      "h1.text-heading-xlarge",
      "main section.artdeco-card h1",
      "main h1.break-words",
      "h1.org-top-card-summary__title",
      "h1[class*='org-top-card']",
      ".org-top-card-primary-content__title",
      "[data-view-name='profile-card'] h1",
      "main h1",
    ]

    for (const selector of selectors) {
      const nodes = document.querySelectorAll(selector)
      for (const el of nodes) {
        const text = el.textContent?.trim()
        if (!text || text.length > 120) continue
        if (!el.isConnected) continue
        const rect = el.getBoundingClientRect()
        if (rect.width <= 0 || rect.height <= 0) continue
        if (el.closest("nav, footer, aside")) continue
        return el
      }
    }
    return null
  }

  function findProfileHeaderRow(nameEl) {
    if (!nameEl) return null
    let node = nameEl.parentElement
    for (let depth = 0; depth < 6 && node; depth += 1) {
      const style = window.getComputedStyle(node)
      if (
        style.display.includes("flex") ||
        node.classList.contains("ph5") ||
        node.dataset?.viewName ||
        node.classList.contains("pv-text-details__left-panel")
      ) {
        return node
      }
      node = node.parentElement
    }
    return nameEl.parentElement
  }

  function mountBadgeBesideName(root) {
    const nameEl = findProfileNameElement()
    if (!nameEl) return false

    root.classList.remove("equipify-sales-linkedin-badge-root--floating")

    const headerRow = findProfileHeaderRow(nameEl)
    if (headerRow && !headerRow.classList.contains("equipify-sales-linkedin-badge-host")) {
      headerRow.classList.add("equipify-sales-linkedin-badge-host")
    }

    if (root.previousElementSibling === nameEl && root.parentElement === nameEl.parentElement) {
      mountMode = "inline"
      return true
    }

    if (root.parentElement && root.parentElement !== nameEl.parentElement) {
      root.remove()
    }

    nameEl.insertAdjacentElement("afterend", root)
    mountMode = "inline"
    logInfo("mount_inline_after_name", { name: nameEl.textContent?.trim()?.slice(0, 80) ?? null })
    return true
  }

  function mountBadgeNearTopCard(root, reason) {
    const topCard =
      document.querySelector("main section.artdeco-card") ??
      document.querySelector('[data-view-name="profile-card"]') ??
      document.querySelector(".org-top-card")

    root.classList.remove("equipify-sales-linkedin-badge-root--floating")
    if (topCard) {
      const host = topCard.querySelector(".ph5") ?? topCard
      if (root.parentElement !== host) {
        root.remove()
        host.appendChild(root)
      }
      mountMode = "inline"
      logInfo("mount_top_card", { reason })
      return true
    }

    mountBadgeFloating(root, reason)
    return false
  }

  function mountBadgeFloating(root, reason) {
    root.classList.add("equipify-sales-linkedin-badge-root--floating")
    if (root.parentElement !== document.body) {
      root.remove()
      document.body.appendChild(root)
    }
    mountMode = "floating"
    logInfo("mount_floating_fallback", { reason })
  }

  function scheduleMountRetry(root) {
    if (mountObserver) return
    mountObserver = new MutationObserver(() => {
      if (mountBadgeBesideName(root)) {
        mountObserver.disconnect()
        mountObserver = null
        if (mountRetryTimer) window.clearTimeout(mountRetryTimer)
        mountRetryTimer = null
      }
    })
    mountObserver.observe(document.body, { subtree: true, childList: true })

    if (mountRetryTimer) window.clearTimeout(mountRetryTimer)
    mountRetryTimer = window.setTimeout(() => {
      if (mountMode === "inline") return
      if (mountBadgeBesideName(root)) {
        mountObserver?.disconnect()
        mountObserver = null
        return
      }
      if (findProfileNameElement()) {
        mountBadgeNearTopCard(root, "mount_failed_after_retry")
      } else {
        mountBadgeFloating(root, "no_profile_h1_after_retry")
      }
      mountObserver?.disconnect()
      mountObserver = null
    }, MOUNT_RETRY_MS)
  }

  function openSidebar() {
    if (window.EquipifySalesInpageSidebar?.open?.()) return
    chrome.runtime.sendMessage({ type: "equipify-open-inpage-sidebar" }).catch(() => {})
  }

  function buildRenderKey(payload, display) {
    return [
      display.key,
      payload?.matched ? "matched" : "unmatched",
      prospectingMode ? "scan" : "default",
      pageKind(),
      mountMode,
    ].join("|")
  }

  function resolveBadgeDisplay(payload, hasProfileContext) {
    if (linkedinStatus.resolveLinkedInPageBadgeDisplay) {
      return linkedinStatus.resolveLinkedInPageBadgeDisplay(payload, { hasProfileContext })
    }
    return linkedinStatus.resolveProspectDisplayBadge(payload)
  }

  function createBadgeButton(display, options = {}) {
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
      if (options.onRetry) {
        options.onRetry()
        return
      }
      openSidebar()
    })

    return btn
  }

  function ensureBadgeRoot() {
    let root = document.getElementById(BADGE_ROOT_ID)
    if (!root) {
      root = document.createElement("div")
      root.id = BADGE_ROOT_ID
      root.className = "equipify-sales-linkedin-badge-root"
    }

    if (mountMode === "inline") {
      mountBadgeBesideName(root)
    } else if (mountMode === "floating") {
      mountBadgeFloating(root, "existing_floating")
    } else if (!mountBadgeBesideName(root)) {
      scheduleMountRetry(root)
    }

    badgeRoot = root
    return root
  }

  function renderBadge(payload, hasProfileContext = true) {
    clearLookupDeadline()
    lookupInFlight = false
    latestPayload = payload
    const display = resolveBadgeDisplay(payload, hasProfileContext)
    const renderKey = buildRenderKey(payload, display)
    if (renderKey === lastRenderKey && badgeRoot?.isConnected) return

    const root = ensureBadgeRoot()
    root.replaceChildren()
    const onRetry =
      display.key === "lookup_error" || payload?.error
        ? () => scheduleRefresh(true)
        : undefined
    root.appendChild(createBadgeButton(display, { onRetry }))
    lastRenderKey = renderKey
    logInfo("render_badge", { label: display.displayLabel, mountMode })
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
    btn.addEventListener("click", () => scheduleRefresh(true))
    root.appendChild(btn)
  }

  function scheduleLookupDeadline(generation, hasProfileContext) {
    clearLookupDeadline()
    lookupDeadlineTimer = window.setTimeout(() => {
      if (generation !== refreshGeneration) return
      if (!lookupInFlight) return
      logInfo("lookup_deadline_terminal", { ms: LOOKUP_DEADLINE_MS })
      renderBadge(
        {
          ...defaultPayload(),
          error_status: 408,
          error: "crm_context_timeout",
          message: "CRM lookup timed out. Click to retry.",
        },
        hasProfileContext,
      )
    }, LOOKUP_DEADLINE_MS)
  }

  async function refreshBadge(options = {}) {
    if (!pageKindSupported()) {
      removeBadge()
      return
    }

    const generation = ++refreshGeneration
    const params = buildLookupParams()
    const hasProfileContext = [...params.keys()].length > 0

    if (!options.skipLoading) renderLoadingBadge()

    if (!hasProfileContext) {
      renderBadge(defaultPayload(), false)
      return
    }

    lookupInFlight = true
    scheduleLookupDeadline(generation, hasProfileContext)

    try {
      const payload = await fetchCrmContext(options)
      if (generation !== refreshGeneration) return
      renderBadge(payload ?? defaultPayload(), true)
    } catch (error) {
      if (generation !== refreshGeneration) return
      logError("refresh_badge_failed", error)
      renderBadge(
        {
          ...defaultPayload(),
          error_status: 0,
          error: "crm_context_failed",
          message: "CRM lookup failed. Click to retry.",
        },
        true,
      )
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
      mountMode = "pending"
      scheduleRefresh()
      return
    }

    if (badgeRoot?.isConnected && mountMode !== "inline" && findProfileNameElement()) {
      mountBadgeBesideName(badgeRoot)
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
    logInfo("init")
    refreshBadge({ skipLoading: false }).catch(() => removeBadge())
  })

  window.EquipifySalesContactSaved?.onEquipifyContactSaved?.((detail) => {
    lookupCache?.invalidate?.(lookupCache.PREFIX?.crmContext)
    lookupCache?.invalidate?.(lookupCache.PREFIX?.lookup)
    lookupCache?.invalidateMatching?.([detail.linkedin_url, detail.source_url, detail.lead_id])
    lastRenderKey = null
    const optimistic = {
      ok: true,
      matched: true,
      status_badge: "already_added",
      status_badge_label: "Already in Equipify",
      context: {
        lead_id: detail.lead_id,
        company_name: detail.company_name,
        contact_name: detail.contact_name,
        status_badge: "already_added",
        status_badge_label: "Already in Equipify",
        links: detail.crm_url ? { lead: detail.crm_url } : {},
      },
    }
    renderBadge(optimistic, true)
    scheduleRefresh(true)
  })
})()
