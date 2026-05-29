/**
 * LinkedIn CRM context overlay — visible metadata + Growth Engine lookup/context only.
 */
;(function initEquipifyLinkedInCrmOverlay() {
  const storage = window.EquipifyGrowthExtensionStorage
  const config = window.EquipifyGrowthExtensionConfig
  const linkedinContext = window.EquipifyGrowthLinkedInContext
  const crmContextUi = window.EquipifyGrowthCrmContext
  const lookupCache = window.EquipifyGrowthExtensionLookupCache

  if (!storage || !config || !linkedinContext || !crmContextUi) return

  const OVERLAY_ID = "equipify-growth-linkedin-crm-overlay"
  const REFRESH_DEBOUNCE_MS = 800
  const NAV_THROTTLE_MS = 1000
  let refreshTimer = null
  let lastUrl = null
  let lastNavCheck = 0
  let noteOpen = false
  let collapsed = true
  let lastRenderKey = null
  let overlayNode = null

  async function apiBaseUrl() {
    const settings = await storage.loadExtensionSettings()
    return settings.apiBaseUrl || config.EXTENSION_API_PRESETS.production
  }

  function pageKindSupported() {
    const kind = linkedinContext.detectLinkedInPageKind(window.location.href)
    return kind === "profile" || kind === "company"
  }

  function removeOverlay() {
    document.getElementById(OVERLAY_ID)?.remove()
    overlayNode = null
    noteOpen = false
    lastRenderKey = null
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

    const cacheKey = lookupCache?.buildKey?.(lookupCache.PREFIX.crmContext, params)
    if (!options.bypassCache && cacheKey) {
      const cached = lookupCache.read(cacheKey)
      if (cached !== null) return cached
    }

    const response = await fetch(`${await apiBaseUrl()}${config.CRM_CONTEXT_PATH}?${params.toString()}`, {
      method: "GET",
      credentials: "include",
    })
    const body = await response.json().catch(() => null)
    if (!response.ok || !body?.ok) return null
    if (cacheKey) lookupCache?.write?.(cacheKey, body)
    return body
  }

  async function markReviewed(leadId) {
    const response = await fetch(config.capturedLeadActionUrl(await apiBaseUrl(), leadId), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_reviewed" }),
    })
    const body = await response.json().catch(() => null)
    if (!response.ok || !body?.ok) {
      throw new Error(body?.result?.message ?? body?.message ?? "Could not mark reviewed.")
    }
  }

  async function appendLeadNote(leadId, existingNotes, noteText) {
    const stamp = new Date().toLocaleString()
    const nextNote = existingNotes?.trim()
      ? `${existingNotes.trim()}\n\n[Extension ${stamp}]\n${noteText.trim()}`
      : `[Extension ${stamp}]\n${noteText.trim()}`

    const response = await fetch(`${await apiBaseUrl()}${config.LEAD_PATH}/${leadId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: nextNote }),
    })
    const body = await response.json().catch(() => null)
    if (!response.ok || !body?.ok) {
      throw new Error(body?.message ?? "Could not save note.")
    }
  }

  function buildRenderKey(payload) {
    const matched = payload?.matched === true && payload?.context
    const context = payload?.context ?? null
    return [
      payload?.status_badge ?? "not_added",
      matched ? context?.lead_id ?? "matched" : "unmatched",
      context?.status_badge ?? "",
      collapsed ? "collapsed" : "expanded",
      noteOpen ? "note" : "no-note",
    ].join("|")
  }

  function setCollapsed(nextCollapsed) {
    collapsed = nextCollapsed
    if (!overlayNode) return
    overlayNode.classList.toggle("equipify-growth-crm-overlay--collapsed", collapsed)
    const toggle = overlayNode.querySelector(".equipify-growth-crm-overlay__toggle")
    if (toggle) {
      toggle.textContent = collapsed ? "Show details" : "Hide details"
      toggle.setAttribute("aria-expanded", collapsed ? "false" : "true")
    }
  }

  function renderOverlay(payload) {
    const renderKey = buildRenderKey(payload)
    if (renderKey === lastRenderKey && overlayNode?.isConnected) return

    if (noteOpen) collapsed = false

    const matched = payload?.matched === true && payload?.context
    const context = payload?.context ?? null
    const badge = payload?.status_badge ?? "not_added"
    const badgeLabel = payload?.status_badge_label ?? "Not in Equipify"
    const tone = crmContextUi.badgeToneFromStatus(badge)

    let wrap = overlayNode
    if (!wrap?.isConnected) {
      removeOverlay()
      wrap = document.createElement("div")
      wrap.id = OVERLAY_ID
      wrap.className = "equipify-growth-crm-overlay equipify-growth-crm-overlay--collapsed"
      document.body.appendChild(wrap)
      overlayNode = wrap
    } else {
      wrap.replaceChildren()
      wrap.classList.toggle("equipify-growth-crm-overlay--collapsed", collapsed)
    }

    const header = document.createElement("div")
    header.className = "equipify-growth-crm-overlay__header"

    const badgeEl = document.createElement("span")
    badgeEl.className = "equipify-growth-crm-overlay__badge"
    badgeEl.dataset.tone = tone
    badgeEl.textContent = badgeLabel
    badgeEl.title = matched && context?.match_summary ? context.match_summary : badgeLabel
    badgeEl.style.cursor = collapsed ? "pointer" : "default"
    badgeEl.addEventListener("click", () => {
      if (!collapsed) return
      setCollapsed(false)
      lastRenderKey = null
      renderOverlay(payload)
    })

    const title = document.createElement("strong")
    title.className = "equipify-growth-crm-overlay__title"
    title.textContent = matched ? context.company_name : "Equipify Sales"

    const toggle = document.createElement("button")
    toggle.type = "button"
    toggle.className = "equipify-growth-crm-overlay__toggle"
    toggle.textContent = collapsed ? "Show details" : "Hide details"
    toggle.setAttribute("aria-expanded", collapsed ? "false" : "true")
    toggle.title = "Expand or collapse Equipify CRM context on this page"
    toggle.addEventListener("click", () => {
      setCollapsed(!collapsed)
      lastRenderKey = null
      renderOverlay(payload)
    })

    header.appendChild(badgeEl)
    header.appendChild(title)
    header.appendChild(toggle)
    wrap.appendChild(header)

    const body = document.createElement("div")
    body.className = "equipify-growth-crm-overlay__body"

    if (matched) {
      const grid = document.createElement("div")
      grid.className = "equipify-growth-crm-overlay__grid"
      for (const row of crmContextUi.crmContextRows(context)) {
        const item = document.createElement("div")
        item.className = "equipify-growth-crm-overlay__row"
        item.innerHTML = `<span class="equipify-growth-crm-overlay__label">${row.label}</span><span class="equipify-growth-crm-overlay__value">${row.value}</span>`
        grid.appendChild(item)
      }
      body.appendChild(grid)

      if (context.match_summary) {
        const match = document.createElement("div")
        match.className = "equipify-growth-crm-overlay__match"
        match.textContent = context.match_summary
        body.appendChild(match)
      }

      const actions = document.createElement("div")
      actions.className = "equipify-growth-crm-overlay__actions"

      const mkBtn = (label, title, href, onClick) => {
        const btn = document.createElement(href ? "a" : "button")
        btn.className = "equipify-growth-crm-overlay__btn"
        btn.textContent = label
        btn.title = title
        if (href) {
          btn.href = href
          btn.target = "_blank"
          btn.rel = "noopener noreferrer"
        } else {
          btn.type = "button"
          btn.addEventListener("click", onClick)
        }
        return btn
      }

      actions.appendChild(mkBtn("Open lead", "Open this lead in Equipify admin", context.links.lead))
      actions.appendChild(mkBtn("Open company", "Open the matched company record", context.links.company))
      actions.appendChild(
        mkBtn("Open opportunity", "Open the related opportunity if one exists", context.links.opportunity),
      )
      actions.appendChild(
        mkBtn("Mark reviewed", "Mark this lead as reviewed in Growth Engine", null, async () => {
          try {
            lookupCache?.invalidate?.(lookupCache.PREFIX?.crmContext)
            await markReviewed(context.lead_id)
            scheduleRefresh(true)
          } catch {
            // no-op
          }
        }),
      )
      actions.appendChild(
        mkBtn("Add note", "Append a note to this lead from the extension", null, () => {
          if (noteOpen) return
          noteOpen = true
          lastRenderKey = null
          renderOverlay(payload)
        }),
      )
      body.appendChild(actions)

      if (noteOpen) {
        const noteWrap = document.createElement("div")
        noteWrap.className = "equipify-growth-crm-overlay__note"
        const textarea = document.createElement("textarea")
        textarea.rows = 3
        textarea.placeholder = "Add a note to this lead..."
        const saveBtn = document.createElement("button")
        saveBtn.type = "button"
        saveBtn.className = "equipify-growth-crm-overlay__btn equipify-growth-crm-overlay__btn-primary"
        saveBtn.textContent = "Save note"
        saveBtn.title = "Save this note to the lead in Equipify"
        saveBtn.addEventListener("click", async () => {
          const text = textarea.value.trim()
          if (!text) return
          try {
            lookupCache?.invalidate?.(lookupCache.PREFIX?.crmContext)
            await appendLeadNote(context.lead_id, context.lead_notes, text)
            noteOpen = false
            scheduleRefresh(true)
          } catch {
            // no-op
          }
        })
        noteWrap.appendChild(textarea)
        noteWrap.appendChild(saveBtn)
        body.appendChild(noteWrap)
      }
    } else {
      const empty = document.createElement("p")
      empty.className = "equipify-growth-crm-overlay__empty"
      empty.textContent = "No matching Growth Engine lead yet. Capture from the extension popup or side panel."
      body.appendChild(empty)
    }

    wrap.appendChild(body)
    lastRenderKey = renderKey
  }

  async function refreshOverlay(options = {}) {
    if (!pageKindSupported()) {
      removeOverlay()
      return
    }
    try {
      const payload = await fetchCrmContext(options)
      if (!payload) {
        removeOverlay()
        return
      }
      renderOverlay(payload)
    } catch {
      removeOverlay()
    }
  }

  function scheduleRefresh(bypassCache = false) {
    if (refreshTimer) window.clearTimeout(refreshTimer)
    refreshTimer = window.setTimeout(() => {
      refreshOverlay({ bypassCache }).catch(() => removeOverlay())
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
      noteOpen = false
      scheduleRefresh()
    }
  }

  const observer = new MutationObserver(() => watchNavigation())
  observer.observe(document.documentElement, { subtree: true, childList: true })
  window.addEventListener("popstate", scheduleRefresh)
  window.addEventListener("hashchange", scheduleRefresh)

  lastUrl = window.location.href
  const start = () => scheduleRefresh()
  if (window.requestIdleCallback) {
    window.requestIdleCallback(start, { timeout: 2000 })
  } else {
    window.setTimeout(start, 0)
  }
})()
