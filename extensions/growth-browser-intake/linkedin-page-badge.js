/**
 * Non-invasive LinkedIn page badge — visible metadata and lookup only.
 */
;(function initEquipifyLinkedInPageBadge() {
  const storage = window.EquipifyGrowthExtensionStorage
  const config = window.EquipifyGrowthExtensionConfig
  const linkedinContext = window.EquipifyGrowthLinkedInContext
  const linkedinStatus = window.EquipifyGrowthLinkedInStatus

  if (!storage || !config || !linkedinContext || !linkedinStatus) return

  const BADGE_ID = "equipify-growth-linkedin-page-badge"
  let refreshTimer = null
  let lastUrl = null

  function trimOrNull(value) {
    const trimmed = (value ?? "").trim()
    return trimmed ? trimmed : null
  }

  async function apiBaseUrl() {
    const settings = await storage.loadExtensionSettings()
    return settings.apiBaseUrl || config.EXTENSION_API_PRESETS.production
  }

  function pageKindSupported() {
    const kind = linkedinContext.detectLinkedInPageKind(window.location.href)
    return kind === "profile" || kind === "company"
  }

  function removeBadge() {
    document.getElementById(BADGE_ID)?.remove()
  }

  function findAnchorElement() {
    const selectors = [
      "main h1",
      "h1.text-heading-xlarge",
      "h1.org-top-card-summary__title",
      "h1.top-card-layout__title",
      ".org-top-card-primary-content__title",
    ]
    for (const selector of selectors) {
      const node = document.querySelector(selector)
      if (node instanceof HTMLElement && node.offsetParent !== null) return node
    }
    return document.querySelector("main h1")
  }

  function renderBadge(status, matchSummary) {
    removeBadge()
    const anchor = findAnchorElement()
    if (!anchor || !anchor.parentElement) return

    const wrap = document.createElement("div")
    wrap.id = BADGE_ID
    wrap.className = "equipify-growth-linkedin-badge-wrap"

    const badge = document.createElement("div")
    badge.className = "equipify-growth-linkedin-badge"
    badge.dataset.tone = status.tone
    badge.setAttribute("role", "status")
    badge.setAttribute("aria-live", "polite")

    const dot = document.createElement("span")
    dot.className = "equipify-growth-linkedin-badge__dot"
    dot.setAttribute("aria-hidden", "true")

    const label = document.createElement("span")
    label.textContent = status.pageLabel

    badge.appendChild(dot)
    badge.appendChild(label)

    if (matchSummary) {
      const meta = document.createElement("span")
      meta.className = "equipify-growth-linkedin-badge__meta"
      meta.textContent = matchSummary
      wrap.appendChild(badge)
      wrap.appendChild(meta)
    } else {
      wrap.appendChild(badge)
    }

    anchor.parentElement.insertBefore(wrap, anchor.nextSibling)
  }

  async function lookupCurrentPage() {
    if (!pageKindSupported()) {
      removeBadge()
      return
    }

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

    if ([...params.keys()].length === 0) {
      removeBadge()
      return
    }

    try {
      const response = await fetch(`${await apiBaseUrl()}${config.LOOKUP_PATH}?${params.toString()}`, {
        method: "GET",
        credentials: "include",
      })
      const body = await response.json().catch(() => null)
      if (!response.ok || !body?.ok) {
        removeBadge()
        return
      }

      const status = linkedinStatus.resolveStatusFromLookup(body)
      renderBadge(status, status.matchSummary)
    } catch {
      removeBadge()
    }
  }

  function scheduleRefresh() {
    if (refreshTimer) window.clearTimeout(refreshTimer)
    refreshTimer = window.setTimeout(() => {
      lookupCurrentPage().catch(() => removeBadge())
    }, 400)
  }

  function watchNavigation() {
    const current = window.location.href
    if (current !== lastUrl) {
      lastUrl = current
      scheduleRefresh()
    }
  }

  const observer = new MutationObserver(() => watchNavigation())
  observer.observe(document.documentElement, { subtree: true, childList: true })

  window.addEventListener("popstate", scheduleRefresh)
  window.addEventListener("hashchange", scheduleRefresh)

  lastUrl = window.location.href
  scheduleRefresh()
})()
