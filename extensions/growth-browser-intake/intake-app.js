/**
 * Shared Growth intake UI for popup and side panel.
 * Uses visible page metadata only — no hidden scraping, messaging, or outreach.
 */

function initIntakeApp(options) {
  const surfaceOption = options?.surface ?? "popup"
  const surface =
    surfaceOption === "inpage" ? "inpage" : surfaceOption === "sidepanel" ? "sidepanel" : "popup"
  const config = window.EquipifyGrowthExtensionConfig
  const storage = window.EquipifyGrowthExtensionStorage
  const linkedinContext = window.EquipifyGrowthLinkedInContext
  const linkedinStatus = window.EquipifyGrowthLinkedInStatus
  const crmContextUi = window.EquipifyGrowthCrmContext
  const lookupCache = window.EquipifyGrowthExtensionLookupCache
  const extensionVersion = window.EquipifyGrowthExtensionVersion
  const logPrefix = `[Equipify Sales:${surface}]`

  let bootstrapTimer = null
  let bootstrapSeq = 0

  const state = {
    mode: "quick",
    intakeMode: "default",
    targetLeadId: null,
    existingLead: null,
    detected: null,
    settings: { ...storage.DEFAULT_SETTINGS },
    lastSave: null,
    linkedinLookup: null,
    linkedinPageKind: null,
    crmContext: null,
    visibleLinkedInPeople: [],
    inpageTabUrl: null,
    inpageContextReceived: false,
  }

  const els = {
    captureStatus: document.getElementById("capture-status"),
    detectedPanel: document.getElementById("detected-panel"),
    detectedCompany: document.getElementById("detected-company"),
    detectedPlatform: document.getElementById("detected-platform"),
    detectedDomain: document.getElementById("detected-domain"),
    existingLeadPanel: document.getElementById("existing-lead-panel"),
    existingLeadSummary: document.getElementById("existing-lead-summary"),
    existingLeadMatchLabel: document.getElementById("existing-lead-match-label"),
    contextWarning: document.getElementById("context-warning"),
    quickFields: document.getElementById("quick-fields"),
    fullFields: document.getElementById("full-fields"),
    quickModeBtn: document.getElementById("quick-mode-btn"),
    fullModeBtn: document.getElementById("full-mode-btn"),
    form: document.getElementById("intake-form"),
    submitBtn: document.getElementById("submit-btn"),
    status: document.getElementById("status"),
    successPanel: document.getElementById("success-panel"),
    successSummary: document.getElementById("success-summary"),
    successOpenLeadBtn: document.getElementById("success-open-lead-btn"),
    successCapturedLink: document.getElementById("success-captured-link"),
    successEmailStatus: document.getElementById("success-email-status"),
    successDiscoveryStatus: document.getElementById("success-discovery-status"),
    successDismissBtn: document.getElementById("success-dismiss-btn"),
    settingsPanel: document.getElementById("settings-panel"),
    settingsToggleBtn: document.getElementById("settings-toggle-btn"),
    apiPresetSelect: document.getElementById("api-preset-select"),
    verifyEmailCheckbox: document.getElementById("verify-email"),
    queueDiscoveryCheckbox: document.getElementById("queue-discovery"),
    prospectingModeCheckbox: document.getElementById("prospecting-mode"),
    linkedInFloatingDockCheckbox: document.getElementById("linkedin-floating-dock"),
    saveSettingsBtn: document.getElementById("save-settings-btn"),
    settingsStatus: document.getElementById("settings-status"),
    recentCapturesPanel: document.getElementById("recent-captures-panel"),
    recentCapturesList: document.getElementById("recent-captures-list"),
    openSidePanelBtn: document.getElementById("open-side-panel-btn"),
    signInLink: document.getElementById("sign-in-link"),
    extensionBuildMeta: document.getElementById("extension-build-meta"),
    extensionVersionBanner: document.getElementById("extension-version-banner"),
    versionInstalled: document.getElementById("version-installed"),
    versionPackaged: document.getElementById("version-packaged"),
    versionLatest: document.getElementById("version-latest"),
    versionGitSha: document.getElementById("version-git-sha"),
    versionBuildTimestamp: document.getElementById("version-build-timestamp"),
    extensionVersionWarning: document.getElementById("extension-version-warning"),
    bootstrapLoading: document.getElementById("bootstrap-loading"),
    linkedinStatusPanel: document.getElementById("linkedin-status-panel"),
    linkedinStatusBadge: document.getElementById("linkedin-status-badge"),
    linkedinStatusContext: document.getElementById("linkedin-status-context"),
    linkedinStatusMatch: document.getElementById("linkedin-status-match"),
    linkedinAddBtn: document.getElementById("linkedin-add-btn"),
    linkedinOpenLeadBtn: document.getElementById("linkedin-open-lead-btn"),
    linkedinUpdateLeadBtn: document.getElementById("linkedin-update-lead-btn"),
    linkedinMarkReviewedBtn: document.getElementById("linkedin-mark-reviewed-btn"),
    linkedinCrmContext: document.getElementById("linkedin-crm-context"),
    linkedinOpenCompanyBtn: document.getElementById("linkedin-open-company-btn"),
    linkedinOpenOpportunityBtn: document.getElementById("linkedin-open-opportunity-btn"),
    linkedinAddNoteBtn: document.getElementById("linkedin-add-note-btn"),
    linkedinNotePanel: document.getElementById("linkedin-note-panel"),
    linkedinNoteInput: document.getElementById("linkedin-note-input"),
    linkedinSaveNoteBtn: document.getElementById("linkedin-save-note-btn"),
  }

  function trimOrNull(value) {
    const trimmed = (value ?? "").trim()
    return trimmed ? trimmed : null
  }

  function logError(scope, error, details = {}) {
    const message = error instanceof Error ? error.message : String(error ?? "unknown")
    console.error(logPrefix, scope, message, details, error)
  }

  function logInfo(scope, details = {}) {
    console.log(logPrefix, scope, details)
  }

  function resolveBootstrapTerminalLabel(crmPayload, metadata, tabUrl) {
    if (isRestrictedTabUrl(tabUrl)) return { label: "No context found", tone: "status-error" }
    if (crmPayload?.error_status === 403) return { label: "Not authorized", tone: "status-error" }
    if (crmPayload?.error_status) return { label: "Error", tone: "status-error" }
    if (!metadata && !state.detected) return { label: "No context found", tone: "status-error" }
    if (crmPayload?.matched) return { label: "Loaded", tone: "status-ready" }
    return { label: "Not in Equipify", tone: "status-ready" }
  }

  function setBootstrapTerminalState(crmPayload, metadata, tabUrl) {
    const terminal = resolveBootstrapTerminalLabel(crmPayload, metadata, tabUrl)
    setCaptureStatus(terminal.label, terminal.tone)
    if (els.bootstrapLoading) {
      const span = els.bootstrapLoading.querySelector("span:last-child")
      if (span) span.textContent = `${terminal.label}.`
    }
    logInfo("bootstrap_terminal", { label: terminal.label, tabUrl, matched: crmPayload?.matched === true })
  }

  function showFallbackError(message = "Could not read this page. Reload LinkedIn or re-open Equipify Sales.") {
    setCaptureStatus("Error", "status-error")
    if (els.bootstrapLoading) {
      const span = els.bootstrapLoading.querySelector("span:last-child")
      if (span) span.textContent = "Error. Retry or reload LinkedIn."
    }
    if (els.contextWarning) {
      els.contextWarning.hidden = false
      els.contextWarning.innerHTML = ""
      const text = document.createElement("span")
      text.textContent = message
      const retry = document.createElement("button")
      retry.type = "button"
      retry.className = "btn-link"
      retry.textContent = "Retry"
      retry.addEventListener("click", () => {
        clearStatus()
        bootstrap().catch((error) => {
          logError("retry_bootstrap_failed", error)
          showFallbackError()
        })
      })
      els.contextWarning.appendChild(text)
      els.contextWarning.appendChild(document.createTextNode(" "))
      els.contextWarning.appendChild(retry)
    }
    setStatus(message, "error")
  }

  function apiBaseUrl() {
    return state.settings.apiBaseUrl || config.EXTENSION_API_PRESETS.production
  }

  function defaultCrmPayload() {
    return {
      ok: true,
      matched: false,
      context: null,
      status_badge: "not_added",
      status_badge_label: "Not In Equipify",
    }
  }

  async function fetchWithTimeout(url, options = {}, timeoutMs = 4000) {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await fetch(url, { ...options, signal: controller.signal })
    } finally {
      window.clearTimeout(timeoutId)
    }
  }

  function setCaptureStatus(text, className) {
    if (!els.captureStatus) return
    els.captureStatus.textContent = text
    els.captureStatus.className = `status-pill ${className}`
  }

  function isRestrictedTabUrl(url) {
    if (!url) return true
    return (
      url.startsWith("chrome://") ||
      url.startsWith("chrome-extension://") ||
      url.startsWith("edge://") ||
      url.startsWith("about:") ||
      url.startsWith("devtools://")
    )
  }

  function leadAdminUrl(leadId) {
    return `${apiBaseUrl()}/admin/growth/leads/${leadId}`
  }

  function capturedLeadsUrl() {
    return `${apiBaseUrl()}${config.CAPTURED_LEADS_PATH}`
  }

  function signInUrl() {
    return `${apiBaseUrl()}${config.SIGN_IN_PATH}`
  }

  function hasContactPayload(payload) {
    return Boolean(
      trimOrNull(payload.contact_name) ||
        trimOrNull(payload.email) ||
        trimOrNull(payload.phone) ||
        trimOrNull(payload.linkedin_url),
    )
  }

  function readFormValues() {
    return {
      company_name: trimOrNull(document.getElementById("company-name")?.value),
      contact_name: trimOrNull(document.getElementById("contact-name")?.value),
      title: trimOrNull(document.getElementById("title")?.value),
      email: trimOrNull(document.getElementById("email")?.value),
      phone: trimOrNull(document.getElementById("phone")?.value),
      website: trimOrNull(document.getElementById("website")?.value),
      linkedin_url: trimOrNull(document.getElementById("linkedin-url")?.value),
      source_url: trimOrNull(document.getElementById("source-url")?.value),
      source_platform: document.getElementById("source-platform-input")?.value || "website",
      page_title: trimOrNull(document.getElementById("page-title-input")?.value),
      location: trimOrNull(document.getElementById("location-input")?.value),
      notes: trimOrNull(document.getElementById("notes")?.value),
      queue_contact_discovery: state.settings.queueContactDiscovery,
      verify_email: state.settings.verifyEmailBeforeSave,
      capture_method: "chrome_extension",
      intake_mode: document.getElementById("intake-mode-input")?.value || "default",
      target_lead_id: trimOrNull(document.getElementById("target-lead-id-input")?.value),
    }
  }

  function applyDetectedMetadata(metadata, tabUrl) {
    if (!metadata) return
    state.detected = metadata
    const companyName = trimOrNull(metadata?.company_name)
    const website = trimOrNull(metadata?.website)
    const linkedinUrl = trimOrNull(metadata?.linkedin_url)
    const linkedinCompanyUrl = trimOrNull(metadata?.linkedin_company_url)
    const sourceUrl = trimOrNull(metadata?.source_url) || trimOrNull(tabUrl)
    const platform = metadata?.source_platform || "website"
    const pageTitle = trimOrNull(metadata?.page_title)
    const contactName = trimOrNull(metadata?.contact_name)
    const headline = trimOrNull(metadata?.headline)
    const location = trimOrNull(metadata?.location)

    const sourceUrlInput = document.getElementById("source-url")
    const platformInput = document.getElementById("source-platform-input")
    const pageTitleInput = document.getElementById("page-title-input")
    const companyInput = document.getElementById("company-name")
    const websiteInput = document.getElementById("website")
    const linkedinInput = document.getElementById("linkedin-url")
    const contactInput = document.getElementById("contact-name")
    const titleInput = document.getElementById("title")
    const locationInput = document.getElementById("location-input")

    if (sourceUrlInput) sourceUrlInput.value = sourceUrl ?? ""
    if (platformInput) platformInput.value = platform
    if (pageTitleInput) pageTitleInput.value = pageTitle ?? ""
    if (companyName && companyInput) companyInput.value = companyName
    if (website && websiteInput) websiteInput.value = website
    if (linkedinUrl && linkedinInput) linkedinInput.value = linkedinUrl
    if (contactName && contactInput && !trimOrNull(contactInput.value)) contactInput.value = contactName
    if (headline && titleInput && !trimOrNull(titleInput.value)) titleInput.value = headline
    if (location && locationInput) locationInput.value = location

    if (linkedinCompanyUrl && linkedinInput && !trimOrNull(linkedinInput.value) && platform === "linkedin") {
      // keep profile URL on profile pages; company URL stays on detected metadata
    }

    if (companyName || contactName) {
      if (els.detectedPanel) els.detectedPanel.hidden = false
      if (els.detectedCompany) els.detectedCompany.textContent = companyName || contactName || "—"
      if (els.detectedPlatform) els.detectedPlatform.textContent = platform
      if (els.detectedDomain) {
        els.detectedDomain.textContent =
          website || linkedinUrl || linkedinCompanyUrl || sourceUrl || location || ""
      }
    } else if (els.detectedPanel) {
      els.detectedPanel.hidden = true
    }
  }

  async function extractTabMetadataInner(tab) {
    if (!tab?.id || isRestrictedTabUrl(tab.url)) return null

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["page-metadata.js", "linkedin-company-people.js"],
    })

    const [metaResult, peopleResult] = await Promise.all([
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.__equipifyGrowthExtract?.() ?? null,
      }),
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.__equipifyGrowthLinkedInCompanyPeople?.() ?? [],
      }),
    ])

    const metadata = metaResult?.[0]?.result ?? null
    const visiblePeople = peopleResult?.[0]?.result ?? []
    if (Array.isArray(visiblePeople) && visiblePeople.length) {
      state.visibleLinkedInPeople = visiblePeople
    }
    return metadata
  }

  async function extractTabMetadata(tab) {
    try {
      return await Promise.race([
        extractTabMetadataInner(tab),
        new Promise((resolve) => window.setTimeout(() => resolve(null), 3500)),
      ])
    } catch (error) {
      logError("extract_tab_metadata_failed", error, { tabUrl: tab?.url })
      return null
    }
  }

  function buildLookupParams(payload, tabUrl) {
    const query =
      linkedinContext?.buildLinkedInLookupQuery({
        url: tabUrl ?? payload.source_url,
        page_title: payload.page_title,
        company_name: payload.company_name,
        website: payload.website,
        linkedin_url: payload.linkedin_url,
        email: payload.email,
      }) ?? payload

    const params = new URLSearchParams()
    if (query.company_name) params.set("company_name", query.company_name)
    if (query.website) params.set("website", query.website)
    if (query.linkedin_url) params.set("linkedin_url", query.linkedin_url)
    if (query.email) params.set("email", query.email)
    if (tabUrl) params.set("source_url", tabUrl)
    return params
  }

  function invalidateLookupCache() {
    lookupCache?.invalidate?.(lookupCache.PREFIX?.crmContext)
    lookupCache?.invalidate?.(lookupCache.PREFIX?.lookup)
  }

  async function lookupExistingLead(payload, tabUrl, options = {}) {
    const params = buildLookupParams(payload, tabUrl)
    if ([...params.keys()].length === 0) return null

    const cacheKey = lookupCache?.buildKey?.(lookupCache.PREFIX.lookup, params)
    if (!options.bypassCache && cacheKey) {
      const cached = lookupCache.read(cacheKey)
      if (cached !== null) return cached
    }

    const response = await fetch(`${apiBaseUrl()}${config.LOOKUP_PATH}?${params.toString()}`, {
      method: "GET",
      credentials: "include",
    })

    const body = await response.json().catch(() => null)
    if (!response.ok || !body?.ok) return null
    if (cacheKey) lookupCache?.write?.(cacheKey, body)
    return body
  }

  async function fetchCrmContext(payload, tabUrl, options = {}) {
    const params = buildLookupParams(payload, tabUrl)
    if ([...params.keys()].length === 0) return null

    const cacheKey = lookupCache?.buildKey?.(lookupCache.PREFIX.crmContext, params)
    if (!options.bypassCache && cacheKey) {
      const cached = lookupCache.read(cacheKey)
      if (cached !== null) return cached
    }

    const response = await fetchWithTimeout(
      `${apiBaseUrl()}${config.CRM_CONTEXT_PATH}?${params.toString()}`,
      {
        method: "GET",
        credentials: "include",
      },
    )

    const body = await response.json().catch(() => null)
    if (!response.ok || !body?.ok) {
      return {
        ok: false,
        matched: false,
        context: null,
        status_badge: response.status === 403 ? "needs_review" : "not_added",
        status_badge_label:
          response.status === 403 ? "Not authorized" : "Not In Equipify",
        error_status: response.status,
        error: body?.error ?? "crm_context_failed",
        message: body?.message ?? "Could not load CRM context.",
      }
    }
    if (cacheKey) lookupCache?.write?.(cacheKey, body)
    return body
  }

  function renderSalesWorkspace(crmPayload, tabUrl) {
    const workspace = window.EquipifySalesWorkspace
    if (!workspace?.render) return

    workspace.render({
      crmPayload,
      detected: state.detected,
      formValues: readFormValues(),
      existingLead: state.existingLead,
      recentCaptures: null,
      profilePhotoUrl: state.detected?.profile_photo_url ?? null,
      visibleLinkedInPeople: state.visibleLinkedInPeople ?? [],
    })

    storage.loadRecentCaptures().then((captures) => {
      workspace.render({
        crmPayload,
        detected: state.detected,
        formValues: readFormValues(),
        existingLead: state.existingLead,
        recentCaptures: captures,
        profilePhotoUrl: state.detected?.profile_photo_url ?? null,
        visibleLinkedInPeople: state.visibleLinkedInPeople ?? [],
      })
    })
  }

  function renderLinkedInCrmContextGrid(context) {
    if (!els.linkedinCrmContext || !crmContextUi) return
    els.linkedinCrmContext.innerHTML = ""

    if (!context) {
      els.linkedinCrmContext.hidden = true
      return
    }

    els.linkedinCrmContext.hidden = false
    for (const row of crmContextUi.crmContextRows(context)) {
      const item = document.createElement("div")
      item.className = "linkedin-crm-context-row"
      item.innerHTML = `<span class="linkedin-crm-context-label">${row.label}</span><span class="linkedin-crm-context-value">${row.value}</span>`
      els.linkedinCrmContext.appendChild(item)
    }
  }

  function renderLinkedInStatusPanel(crmPayload, tabUrl) {
    if (!els.linkedinStatusPanel) return

    state.crmContext = crmPayload?.context ?? null
    state.linkedinPageKind =
      crmPayload?.linkedin_page_kind ?? linkedinContext?.detectLinkedInPageKind(tabUrl) ?? null

    const matched = crmPayload?.matched === true && state.crmContext
    const display =
      linkedinStatus?.resolveProspectDisplayBadge?.(crmPayload) ?? {
        displayLabel: crmPayload?.status_badge_label ?? "Not In Equipify",
        emoji: "⚪",
        tone: "neutral",
        matchSummary: state.crmContext?.match_summary ?? null,
      }
    const badge = display.key ?? crmPayload?.status_badge ?? "not_added"
    const badgeLabel = `${display.emoji} ${display.displayLabel}`
    const tone = display.tone ?? crmContextUi?.badgeToneFromStatus(badge) ?? "neutral"

    if (els.linkedinStatusBadge) {
      els.linkedinStatusBadge.textContent = badgeLabel
      if (surface === "sidepanel" || surface === "inpage") {
        els.linkedinStatusBadge.className = "es-ws-hidden-compat"
      } else {
        els.linkedinStatusBadge.className = `linkedin-status-badge badge-${tone}`
      }
    }

    const contextParts = []
    if (state.linkedinPageKind === "profile") contextParts.push("LinkedIn profile")
    if (state.linkedinPageKind === "company") contextParts.push("LinkedIn company")
    if (state.crmContext?.company_name) contextParts.push(state.crmContext.company_name)
    if (els.linkedinStatusContext) els.linkedinStatusContext.textContent = contextParts.join(" · ")

    if (crmPayload?.error_status === 403) {
      showFallbackError("Not authorized. Sign in to Equipify as a platform admin, then retry.")
    } else if (crmPayload?.error_status) {
      showFallbackError("Could not read this page. Reload LinkedIn or re-open Equipify Sales.")
    }

    const profileName =
      state.crmContext?.contact_name ||
      trimOrNull(document.getElementById("contact-name")?.value) ||
      state.detected?.company_name ||
      "Current page"
    const titleText =
      state.crmContext?.company_name && state.crmContext?.contact_name
        ? `${state.crmContext.contact_name}`
        : profileName
    document.getElementById("popup-profile-name")?.replaceChildren(document.createTextNode(titleText))
    document.getElementById("sidepanel-profile-name")?.replaceChildren(document.createTextNode(titleText))

    const matchSummary = state.crmContext?.match_summary ?? null
    if (els.linkedinStatusMatch) {
      els.linkedinStatusMatch.textContent = matchSummary ?? ""
      els.linkedinStatusMatch.hidden = !matchSummary
    }

    renderLinkedInCrmContextGrid(state.crmContext)

    const hasMatch = Boolean(state.crmContext?.lead_id)
    if (els.linkedinOpenLeadBtn) els.linkedinOpenLeadBtn.hidden = !hasMatch
    if (els.linkedinOpenCompanyBtn) els.linkedinOpenCompanyBtn.hidden = !hasMatch
    if (els.linkedinOpenOpportunityBtn) els.linkedinOpenOpportunityBtn.hidden = !hasMatch
    if (els.linkedinUpdateLeadBtn) els.linkedinUpdateLeadBtn.hidden = !hasMatch
    if (els.linkedinMarkReviewedBtn) {
      els.linkedinMarkReviewedBtn.hidden =
        !hasMatch || state.crmContext?.status_badge !== "needs_review"
    }
    if (els.linkedinAddNoteBtn) els.linkedinAddNoteBtn.hidden = !hasMatch
    if (els.linkedinNotePanel && !hasMatch) els.linkedinNotePanel.hidden = true

    window.__equipifyCopilotHooks?.onCrmContextUpdated?.(state.crmContext, state.linkedinPageKind)

    if (hasMatch) {
      const pseudoMatch = {
        lead_id: state.crmContext.lead_id,
        company_name: state.crmContext.company_name,
        website: null,
        confidence: 1,
        rule: "explicit",
        match_label: matchSummary,
        review_status: state.crmContext.status_badge === "needs_review" ? "needs_review" : "reviewed",
      }
      state.existingLead = pseudoMatch
      state.linkedinLookup = crmPayload
      showExistingLead(pseudoMatch)
    } else {
      state.existingLead = null
      state.linkedinLookup = crmPayload
      if (els.existingLeadPanel) els.existingLeadPanel.hidden = true
    }

    if (surface === "sidepanel" || surface === "inpage") {
      renderSalesWorkspace(crmPayload, tabUrl)
    }
  }

  async function appendLeadNote(leadId, existingNotes, noteText) {
    const stamp = new Date().toLocaleString()
    const nextNote = existingNotes?.trim()
      ? `${existingNotes.trim()}\n\n[Extension ${stamp}]\n${noteText.trim()}`
      : `[Extension ${stamp}]\n${noteText.trim()}`

    const response = await fetch(`${apiBaseUrl()}${config.LEAD_PATH}/${leadId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: nextNote }),
    })
    const body = await response.json().catch(() => null)
    if (!response.ok || !body?.ok) {
      throw new Error(body?.message ?? "Could not save note.")
    }
    return body
  }

  async function markLeadReviewed(leadId) {
    const response = await fetch(config.capturedLeadActionUrl(apiBaseUrl(), leadId), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_reviewed" }),
    })
    const body = await response.json().catch(() => null)
    if (!response.ok || !body?.ok) {
      throw new Error(body?.result?.message ?? body?.message ?? "Could not mark reviewed.")
    }
    return body
  }

  function showExistingLead(match) {
    if (!match || match.confidence < 0.7) {
      if (els.existingLeadPanel) els.existingLeadPanel.hidden = true
      state.existingLead = null
      return
    }

    state.existingLead = match
    if (!els.existingLeadPanel) return
    els.existingLeadPanel.hidden = false
    if (els.existingLeadSummary) {
      els.existingLeadSummary.textContent = `${match.company_name}${match.website ? ` · ${match.website}` : ""}`
    }
    if (els.existingLeadMatchLabel) {
      const label =
        match.match_label || config.formatMatchRuleLabel(match.rule)
      els.existingLeadMatchLabel.textContent = label
    }
  }

  function setIntakeMode(mode, targetLeadId = null) {
    state.intakeMode = mode
    state.targetLeadId = targetLeadId
    const modeInput = document.getElementById("intake-mode-input")
    const targetInput = document.getElementById("target-lead-id-input")
    if (modeInput) modeInput.value = mode
    if (targetInput) targetInput.value = targetLeadId ?? ""
  }

  function setMode(mode) {
    state.mode = mode
    const quick = mode === "quick"
    els.quickModeBtn?.classList.toggle("active", quick)
    els.fullModeBtn?.classList.toggle("active", !quick)
    if (els.quickFields) els.quickFields.hidden = !quick
    if (els.fullFields) els.fullFields.hidden = quick
  }

  function setStatus(message, type) {
    if (!els.status) return
    els.status.hidden = false
    els.status.textContent = message
    els.status.className = `message message-${type}`
  }

  function clearStatus() {
    if (els.status) {
      els.status.hidden = true
      els.status.textContent = ""
    }
    if (els.successPanel) els.successPanel.hidden = true
  }

  function formatApiError(status, payload) {
    if (status === 403) {
      if (payload?.error === "feature_disabled") return "Growth Engine is disabled."
      return `Sign in to ${apiBaseUrl()} as a platform admin.`
    }
    if (status === 409) {
      const reason = payload?.result?.reason ?? payload?.message
      return reason ? `Suppressed: ${reason}` : "Contact suppressed."
    }
    return payload?.result?.message ?? payload?.message ?? payload?.error ?? `Request failed (${status}).`
  }

  function hideSuccessPanel() {
    if (els.successPanel) els.successPanel.hidden = true
    state.lastSave = null
  }

  function showSuccessPanel(saveRecord) {
    if (!els.successPanel) return
    state.lastSave = saveRecord
    els.successPanel.hidden = false

    const company = saveRecord.company_name || "Lead"
    const contact = saveRecord.contact_name ? ` · ${saveRecord.contact_name}` : ""
    if (els.successSummary) els.successSummary.textContent = `${company}${contact}`

    if (els.successOpenLeadBtn) els.successOpenLeadBtn.onclick = () => {
      chrome.tabs.create({ url: leadAdminUrl(saveRecord.lead_id) })
    }
    if (els.successCapturedLink) els.successCapturedLink.href = capturedLeadsUrl()
    if (els.successEmailStatus) els.successEmailStatus.textContent = config.formatEmailStatus(
      saveRecord.email_status,
      saveRecord.verified_by_provider,
    )
    if (els.successDiscoveryStatus) els.successDiscoveryStatus.textContent = config.formatDiscoveryStatus(
      saveRecord.contact_discovery_queued,
    )
  }

  function renderRecentCaptures(captures) {
    if (!els.recentCapturesList) return
    els.recentCapturesList.innerHTML = ""

    if (!captures.length) {
      const empty = document.createElement("p")
      empty.className = "muted recent-empty"
      empty.textContent = "No recent captures yet."
      els.recentCapturesList.appendChild(empty)
      return
    }

    for (const capture of captures) {
      const item = document.createElement("div")
      item.className = "recent-item"

      const title = document.createElement("div")
      title.className = "recent-item-title"
      title.textContent = capture.company_name || "Untitled lead"

      const meta = document.createElement("div")
      meta.className = "recent-item-meta muted"
      const when = capture.saved_at ? new Date(capture.saved_at).toLocaleString() : ""
      meta.textContent = [when, capture.capture_type === "company_only" ? "Company-only" : null]
        .filter(Boolean)
        .join(" · ")

      const actions = document.createElement("div")
      actions.className = "button-row"

      const openBtn = document.createElement("button")
      openBtn.type = "button"
      openBtn.className = "btn-secondary"
      openBtn.textContent = "Open lead"
      openBtn.addEventListener("click", () => {
        chrome.tabs.create({ url: leadAdminUrl(capture.lead_id) })
      })

      actions.appendChild(openBtn)
      item.appendChild(title)
      item.appendChild(meta)
      item.appendChild(actions)
      els.recentCapturesList.appendChild(item)
    }
  }

  async function refreshRecentCaptures() {
    if (!els.recentCapturesList) return
    const captures = await storage.loadRecentCaptures()
    renderRecentCaptures(captures)
  }

  async function applySettingsToUi() {
    state.settings = await storage.loadExtensionSettings()

    if (els.apiPresetSelect) {
      const preset =
        state.settings.apiBaseUrl === config.EXTENSION_API_PRESETS.local ? "local" : "production"
      els.apiPresetSelect.value = preset
    }
    if (els.verifyEmailCheckbox) {
      els.verifyEmailCheckbox.checked = state.settings.verifyEmailBeforeSave
    }
    if (els.queueDiscoveryCheckbox) {
      els.queueDiscoveryCheckbox.checked = state.settings.queueContactDiscovery
    }
    if (els.prospectingModeCheckbox) {
      els.prospectingModeCheckbox.checked = state.settings.prospectingMode === true
    }
    if (els.linkedInFloatingDockCheckbox) {
      const dockPrefs = await storage.loadLinkedInFloatingDockPrefs()
      els.linkedInFloatingDockCheckbox.checked = dockPrefs.enabled !== false
    }
    if (els.signInLink) {
      els.signInLink.href = signInUrl()
    }
  }

  async function saveSettingsFromUi() {
    const preset = els.apiPresetSelect?.value === "local" ? "local" : "production"
    const nextSettings = {
      apiPreset: preset,
      apiBaseUrl: config.EXTENSION_API_PRESETS[preset],
      verifyEmailBeforeSave: els.verifyEmailCheckbox?.checked === true,
      queueContactDiscovery: els.queueDiscoveryCheckbox?.checked === true,
      prospectingMode: els.prospectingModeCheckbox?.checked === true,
    }
    await storage.saveExtensionSettings(nextSettings)
    state.settings = nextSettings
    if (els.linkedInFloatingDockCheckbox) {
      await storage.saveLinkedInFloatingDockPrefs({
        enabled: els.linkedInFloatingDockCheckbox.checked === true,
      })
    }
    if (els.settingsStatus) {
      els.settingsStatus.hidden = false
      els.settingsStatus.textContent = "Settings saved."
      els.settingsStatus.className = "message message-success"
    }
    if (els.signInLink) els.signInLink.href = signInUrl()
    await loadVersionInfo()
  }

  function setLoadingState(isLoading) {
    if (els.bootstrapLoading) {
      els.bootstrapLoading.hidden = !isLoading
      if (isLoading) {
        const span = els.bootstrapLoading.querySelector("span:last-child")
        if (span) span.textContent = "Loading page context…"
      }
    }
    if (els.linkedinStatusPanel) {
      els.linkedinStatusPanel.classList.toggle("panel-loading", isLoading)
    }
  }

  async function waitForInpageContext(maxMs = 1200) {
    if (state.inpageContextReceived && state.detected) return state.detected
    const started = Date.now()
    while (Date.now() - started < maxMs) {
      if (state.inpageContextReceived && state.detected) return state.detected
      await new Promise((resolve) => window.setTimeout(resolve, 80))
    }
    return state.detected
  }

  async function refreshOperatorAnalytics() {
    const analytics = window.EquipifyGrowthExtensionAnalytics
    if (!analytics?.getAnalyticsSummary || !analytics?.renderAnalyticsHtml) return

    const todayEl = document.getElementById("analytics-today")
    const weekEl = document.getElementById("analytics-week")
    const monthEl = document.getElementById("analytics-month")
    if (!todayEl && !weekEl && !monthEl) return

    const [today, week, month] = await Promise.all([
      analytics.getAnalyticsSummary("today"),
      analytics.getAnalyticsSummary("week"),
      analytics.getAnalyticsSummary("month"),
    ])

    if (todayEl) todayEl.innerHTML = analytics.renderAnalyticsHtml(today)
    if (weekEl) weekEl.innerHTML = analytics.renderAnalyticsHtml(week)
    if (monthEl) monthEl.innerHTML = analytics.renderAnalyticsHtml(month)
  }

  function scheduleBootstrap() {
    if (bootstrapTimer) window.clearTimeout(bootstrapTimer)
    bootstrapTimer = window.setTimeout(() => {
      bootstrap().catch(() => {})
    }, 800)
  }

  async function bootstrap() {
    const seq = ++bootstrapSeq
    let finished = false
    const finishLoading = () => {
      if (finished) return
      finished = true
      window.clearTimeout(timeoutId)
      if (seq === bootstrapSeq) setLoadingState(false)
    }

    const timeoutId = window.setTimeout(() => {
      if (seq !== bootstrapSeq) return
      logError("bootstrap_timeout", "Loading page context timed out after 5s")
      renderLinkedInStatusPanel(defaultCrmPayload(), state.inpageTabUrl ?? state.detected?.source_url ?? null)
      showFallbackError("No page context found. Reload LinkedIn or re-open Equipify Sales.")
      finishLoading()
    }, 5000)

    logInfo("bootstrap_start", { surface, inpageContext: state.inpageContextReceived })
    setCaptureStatus("Detecting", "status-detecting")
    setLoadingState(true)
    clearStatus()

    try {
      let tabUrl = state.inpageTabUrl ?? state.detected?.source_url ?? null
      let tab = null

      if (surface !== "inpage") {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
        if (seq !== bootstrapSeq) return
        tab = tabs[0]
        tabUrl = tab?.url ?? tabUrl
      }

      if (isRestrictedTabUrl(tabUrl)) {
        if (els.contextWarning) {
          els.contextWarning.hidden = false
          els.contextWarning.textContent = "Open a website or LinkedIn page, then reopen the extension."
        }
        setBootstrapTerminalState(defaultCrmPayload(), null, tabUrl)
        renderLinkedInStatusPanel(defaultCrmPayload(), tabUrl)
        return
      }

      if (els.contextWarning) els.contextWarning.hidden = true

      let metadata = null
      if (surface === "inpage") {
        metadata = await waitForInpageContext()
        logInfo("bootstrap_inpage_context", {
          received: state.inpageContextReceived,
          hasMetadata: Boolean(metadata),
        })
      } else {
        metadata = state.inpageContextReceived ? state.detected : null
        if (!metadata && tab?.id) {
          logInfo("bootstrap_extract_tab_metadata", { tabId: tab.id })
          metadata = await extractTabMetadata(tab)
        }
      }
      if (seq !== bootstrapSeq) return
      applyDetectedMetadata(metadata ?? state.detected, tabUrl)

      const linkedinQuery = linkedinContext?.buildLinkedInLookupQuery({
        url: tabUrl,
        page_title: metadata?.page_title ?? state.detected?.page_title ?? document.title,
        company_name: metadata?.company_name ?? state.detected?.company_name,
        website: metadata?.website ?? state.detected?.website,
        linkedin_url: metadata?.linkedin_url ?? state.detected?.linkedin_url,
      })
      if (linkedinQuery?.contact_name) {
        const contactInput = document.getElementById("contact-name")
        if (contactInput && !trimOrNull(contactInput.value)) {
          contactInput.value = linkedinQuery.contact_name
        }
      }

      const formValues = readFormValues()
      formValues.page_title = metadata?.page_title ?? state.detected?.page_title ?? formValues.page_title
      if (tabUrl) formValues.source_url = formValues.source_url || tabUrl

      const crmPayload = (await fetchCrmContext(formValues, tabUrl)) ?? defaultCrmPayload()
      if (seq !== bootstrapSeq) return
      logInfo("bootstrap_crm_context", {
        matched: crmPayload?.matched === true,
        errorStatus: crmPayload?.error_status ?? null,
      })
      renderLinkedInStatusPanel(crmPayload, tabUrl)
      setBootstrapTerminalState(crmPayload, metadata ?? state.detected, tabUrl)
    } catch (error) {
      if (seq !== bootstrapSeq) return
      logError("bootstrap_failed", error)
      renderLinkedInStatusPanel(defaultCrmPayload(), state.inpageTabUrl ?? null)
      showFallbackError()
    } finally {
      finishLoading()
    }
  }

  function applyInpageContext(payload) {
    if (!payload) return
    logInfo("inpage_context_received", {
      hasMetadata: Boolean(payload.metadata),
      peopleCount: Array.isArray(payload.visiblePeople) ? payload.visiblePeople.length : 0,
    })
    state.inpageContextReceived = true
    if (payload.tabUrl) state.inpageTabUrl = payload.tabUrl
    if (Array.isArray(payload.visiblePeople)) state.visibleLinkedInPeople = payload.visiblePeople
    if (payload.metadata) applyDetectedMetadata(payload.metadata, payload.tabUrl ?? payload.metadata?.source_url)
  }

  async function saveIntake() {
    clearStatus()

    applyDetectedMetadata(state.detected, state.inpageTabUrl ?? trimOrNull(document.getElementById("source-url")?.value))

    const payload = readFormValues()
    const companyName =
      payload.company_name ||
      state.detected?.company_name ||
      trimOrNull(state.detected?.contact_name)

    if (!companyName) {
      setStatus("Company name is required. Open a LinkedIn profile or company page first.", "error")
      setCaptureStatus("Error", "status-error")
      return false
    }

    payload.company_name = companyName
    if (!payload.contact_name && state.detected?.contact_name) payload.contact_name = state.detected.contact_name
    if (!payload.title && state.detected?.headline) payload.title = state.detected.headline
    if (!payload.linkedin_url && state.detected?.linkedin_url) payload.linkedin_url = state.detected.linkedin_url
    if (!payload.website && state.detected?.website) payload.website = state.detected.website
    if (!payload.location && state.detected?.location) payload.location = state.detected.location
    if (!payload.source_url) payload.source_url = state.inpageTabUrl ?? state.detected?.source_url ?? payload.source_url
    if (!payload.page_title && state.detected?.page_title) payload.page_title = state.detected.page_title
    if (!payload.source_platform && state.detected?.source_platform) {
      payload.source_platform = state.detected.source_platform
    }

    const companyOnly = !hasContactPayload(payload)

    if (!companyOnly && !hasContactPayload(payload)) {
      setStatus("Add contact info or use company-only capture.", "error")
      return false
    }

    if (companyOnly) {
      payload.company_only = true
    }

    if (els.submitBtn) els.submitBtn.disabled = true
    if (document.getElementById("es-ws-add-btn")) document.getElementById("es-ws-add-btn").disabled = true
    setCaptureStatus("Saving", "status-saving")
    logInfo("submit_capture_start", { companyName, companyOnly, intakeMode: payload.intake_mode })

    try {
      const response = await fetch(`${apiBaseUrl()}${config.INTAKE_PATH}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const body = await response.json().catch(() => null)
      const result = body?.result

      if (!response.ok || !body?.ok || !result) {
        const apiError = formatApiError(response.status, body)
        logError("submit_capture_failed", apiError, { status: response.status, body })
        setStatus(apiError, "error")
        setCaptureStatus("Error", "status-error")
        return false
      }

      let message = "Saved to Equipify."
      if (result.status === "created") message = "Lead created."
      if (result.status === "updated") message = "Existing lead updated."
      if (result.capture_type === "company_only") message += " Company prospect saved."
      if (result.contact_discovery_queued) message += " Contact discovery queued."

      setStatus(message, "success")
      setCaptureStatus("Saved", "status-success")
      logInfo("submit_capture_success", { leadId: result.lead_id, status: result.status })

      const saveRecord = {
        lead_id: result.lead_id,
        company_name: companyName,
        contact_name: payload.contact_name,
        saved_at: new Date().toISOString(),
        status: result.status,
        capture_type: result.capture_type ?? (companyOnly ? "company_only" : "contact"),
        email_status: result.email_status ?? null,
        verified_by_provider: result.verified_by_provider === true,
        contact_discovery_queued: result.contact_discovery_queued === true,
      }

      await storage.addRecentCapture(saveRecord)
      await refreshRecentCaptures()
      showSuccessPanel(saveRecord)

      const extensionAnalytics = window.EquipifyGrowthExtensionAnalytics
      if (extensionAnalytics) {
        await extensionAnalytics.recordAnalyticsEvent("captures_created")
        if (result.capture_type === "company_only") {
          await extensionAnalytics.recordAnalyticsEvent("companies_captured")
        } else {
          await extensionAnalytics.recordAnalyticsEvent("contacts_captured")
        }
        if (result.status === "updated") {
          await extensionAnalytics.recordAnalyticsEvent("duplicates_prevented")
        }
        window.__equipifyCopilotHooks?.refreshAnalytics?.()
        if (surface === "popup") await refreshOperatorAnalytics()
      }

      invalidateLookupCache()
      const refreshLookup = await fetchCrmContext(
        readFormValues(),
        trimOrNull(document.getElementById("source-url")?.value) ?? state.inpageTabUrl,
        { bypassCache: true },
      )
      renderLinkedInStatusPanel(
        refreshLookup,
        trimOrNull(document.getElementById("source-url")?.value) ?? state.inpageTabUrl,
      )
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : "Network error"
      logError("submit_capture_network", error)
      setStatus(`Could not reach Equipify (${message}).`, "error")
      setCaptureStatus("Error", "status-error")
      return false
    } finally {
      if (els.submitBtn) els.submitBtn.disabled = false
      const addBtn = document.getElementById("es-ws-add-btn")
      if (addBtn) addBtn.disabled = false
    }
  }

  async function submitIntake(event) {
    event.preventDefault()
    await saveIntake()
  }

  function renderVersionSnapshot(snapshot) {
    if (els.versionInstalled) els.versionInstalled.textContent = `v${snapshot.installed_version}`
    if (els.versionPackaged) {
      els.versionPackaged.textContent = snapshot.packaged_version ? `v${snapshot.packaged_version}` : "—"
    }
    if (els.versionLatest) {
      els.versionLatest.textContent = snapshot.latest_available_version
        ? `v${snapshot.latest_available_version}`
        : "—"
    }
    if (els.versionGitSha) els.versionGitSha.textContent = snapshot.git_sha ?? "—"
    if (els.versionBuildTimestamp) {
      if (snapshot.build_timestamp) {
        const when = new Date(snapshot.build_timestamp)
        els.versionBuildTimestamp.textContent = Number.isNaN(when.getTime())
          ? snapshot.build_timestamp
          : when.toLocaleString()
      } else {
        els.versionBuildTimestamp.textContent = "—"
      }
    }

    if (els.extensionVersionBanner) els.extensionVersionBanner.hidden = false
    if (els.extensionBuildMeta) {
      els.extensionBuildMeta.textContent = extensionVersion?.formatSnapshot?.(snapshot) ?? ""
    }
    if (els.extensionVersionWarning) {
      if (snapshot.is_outdated && snapshot.latest_available_version) {
        els.extensionVersionWarning.hidden = false
        els.extensionVersionWarning.textContent = `Update available: v${snapshot.latest_available_version} is ready. Download the latest Equipify Sales ZIP from Growth Engine settings.`
      } else {
        els.extensionVersionWarning.hidden = true
        els.extensionVersionWarning.textContent = ""
      }
    }
  }

  async function loadVersionInfo() {
    if (!extensionVersion?.resolveVersionSnapshot) {
      if (els.extensionBuildMeta) {
        try {
          const manifest = chrome.runtime.getManifest()
          els.extensionBuildMeta.textContent = manifest?.version ? `v${manifest.version} · local unpackaged` : ""
        } catch {
          els.extensionBuildMeta.textContent = ""
        }
      }
      return
    }

    try {
      const snapshot = await extensionVersion.resolveVersionSnapshot(apiBaseUrl())
      renderVersionSnapshot(snapshot)
    } catch {
      if (els.extensionBuildMeta) els.extensionBuildMeta.textContent = ""
    }
  }

  function wireEvents() {
    els.quickModeBtn?.addEventListener("click", () => setMode("quick"))
    els.fullModeBtn?.addEventListener("click", () => setMode("full"))
    els.form?.addEventListener("submit", submitIntake)

    document.getElementById("open-lead-btn")?.addEventListener("click", () => {
      if (!state.existingLead?.lead_id) return
      chrome.tabs.create({ url: leadAdminUrl(state.existingLead.lead_id) })
    })

    document.getElementById("update-lead-btn")?.addEventListener("click", () => {
      if (!state.existingLead?.lead_id) return
      setIntakeMode("update_existing", state.existingLead.lead_id)
      setStatus("Will update the existing lead on save.", "success")
      window.EquipifyGrowthExtensionAnalytics?.recordAnalyticsEvent?.("duplicates_prevented").then(() => {
        window.__equipifyCopilotHooks?.refreshAnalytics?.()
        if (surface === "popup") refreshOperatorAnalytics().catch(() => {})
      })
    })

    document.getElementById("create-anyway-btn")?.addEventListener("click", () => {
      setIntakeMode("create_new", null)
      els.existingLeadPanel.hidden = true
      setStatus("Will create a new lead on save.", "success")
    })

    els.successDismissBtn?.addEventListener("click", hideSuccessPanel)

    els.settingsToggleBtn?.addEventListener("click", () => {
      const drawer = document.getElementById("settings-drawer")
      if (drawer) {
        drawer.hidden = false
        refreshOperatorAnalytics().catch(() => {})
        return
      }
      if (!els.settingsPanel) return
      els.settingsPanel.hidden = !els.settingsPanel.hidden
      if (!els.settingsPanel.hidden) refreshOperatorAnalytics().catch(() => {})
    })

    window.__equipifyRefreshSettingsAnalytics = () => refreshOperatorAnalytics().catch(() => {})

    els.saveSettingsBtn?.addEventListener("click", () => {
      saveSettingsFromUi().catch(() => {
        if (els.settingsStatus) {
          els.settingsStatus.hidden = false
          els.settingsStatus.textContent = "Could not save settings."
          els.settingsStatus.className = "message message-error"
        }
      })
    })

    document.getElementById("inpage-sidebar-close-btn")?.addEventListener("click", () => {
      window.parent.postMessage({ type: "equipify-inpage-sidebar-close" }, "*")
    })

    window.addEventListener("message", (event) => {
      if (event.data?.type === "equipify-inpage-sidebar-opened") {
        bootstrap().catch(() => {})
      }
      if (event.data?.type === "equipify-inpage-sidebar-refresh") {
        invalidateLookupCache()
        bootstrap().catch(() => {})
      }
    })

    els.openSidePanelBtn?.addEventListener("click", async () => {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
      const tab = tabs[0]
      if (!tab?.id) return

      try {
        await chrome.tabs.sendMessage(tab.id, { type: "equipify-open-inpage-sidebar" })
      } catch {
        if (chrome.sidePanel?.open && tab.windowId != null) {
          await chrome.sidePanel.open({ windowId: tab.windowId })
        }
      }
    })

    els.linkedinAddBtn?.addEventListener("click", () => {
      saveIntake().catch((error) => logError("linkedin_add_btn_failed", error))
    })

    els.linkedinOpenLeadBtn?.addEventListener("click", () => {
      const leadId = state.crmContext?.lead_id ?? state.existingLead?.lead_id
      const link = state.crmContext?.links?.lead
      if (link) {
        chrome.tabs.create({ url: link })
        return
      }
      if (!leadId) return
      chrome.tabs.create({ url: leadAdminUrl(leadId) })
    })

    els.linkedinOpenCompanyBtn?.addEventListener("click", () => {
      const link = state.crmContext?.links?.company
      if (!link) return
      chrome.tabs.create({ url: link })
    })

    els.linkedinOpenOpportunityBtn?.addEventListener("click", () => {
      const link = state.crmContext?.links?.opportunity
      if (!link) return
      chrome.tabs.create({ url: link })
    })

    els.linkedinUpdateLeadBtn?.addEventListener("click", () => {
      const leadId = state.crmContext?.lead_id ?? state.existingLead?.lead_id
      if (!leadId) return
      setIntakeMode("update_existing", leadId)
      setStatus("Will update the existing lead on save.", "success")
      els.form?.scrollIntoView({ behavior: "smooth", block: "start" })
    })

    els.linkedinMarkReviewedBtn?.addEventListener("click", () => {
      const leadId = state.crmContext?.lead_id ?? state.existingLead?.lead_id
      if (!leadId) return
      els.linkedinMarkReviewedBtn.disabled = true
      markLeadReviewed(leadId)
        .then(async () => {
          setStatus("Lead marked reviewed.", "success")
          invalidateLookupCache()
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
          const crmPayload = await fetchCrmContext(readFormValues(), tabs[0]?.url, { bypassCache: true })
          renderLinkedInStatusPanel(crmPayload, tabs[0]?.url)
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : "Could not mark reviewed."
          setStatus(message, "error")
        })
        .finally(() => {
          els.linkedinMarkReviewedBtn.disabled = false
        })
    })

    els.linkedinAddNoteBtn?.addEventListener("click", () => {
      if (!els.linkedinNotePanel) return
      els.linkedinNotePanel.hidden = !els.linkedinNotePanel.hidden
      if (!els.linkedinNotePanel.hidden) els.linkedinNoteInput?.focus()
    })

    els.linkedinSaveNoteBtn?.addEventListener("click", () => {
      const leadId = state.crmContext?.lead_id
      const noteText = trimOrNull(els.linkedinNoteInput?.value)
      if (!leadId || !noteText) return
      els.linkedinSaveNoteBtn.disabled = true
      appendLeadNote(leadId, state.crmContext?.lead_notes, noteText)
        .then(async () => {
          if (els.linkedinNoteInput) els.linkedinNoteInput.value = ""
          if (els.linkedinNotePanel) els.linkedinNotePanel.hidden = true
          setStatus("Note saved.", "success")
          invalidateLookupCache()
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
          const crmPayload = await fetchCrmContext(readFormValues(), tabs[0]?.url, { bypassCache: true })
          renderLinkedInStatusPanel(crmPayload, tabs[0]?.url)
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : "Could not save note."
          setStatus(message, "error")
        })
        .finally(() => {
          els.linkedinSaveNoteBtn.disabled = false
        })
    })

    if (surface === "sidepanel") {
      chrome.tabs.onActivated.addListener(() => {
        scheduleBootstrap()
      })
      chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
        if (changeInfo.status === "complete") {
          chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
            if (tabs[0]?.id === tabId) scheduleBootstrap()
          })
        }
      })
    }

    if (surface === "inpage") {
      window.addEventListener("message", (event) => {
        const type = event.data?.type
        if (type === "equipify-inpage-context") {
          applyInpageContext(event.data)
          scheduleBootstrap()
        }
      })
    }
  }

  async function init() {
    document.body.dataset.surface = surface
    if (surface === "sidepanel") {
      document.body.classList.add("surface-sidepanel")
    } else if (surface === "inpage") {
      document.body.classList.add("surface-inpage")
    } else {
      document.body.classList.add("surface-popup")
    }

    wireEvents()
    setMode("quick")
    await applySettingsToUi()
    await loadVersionInfo()
    await refreshRecentCaptures()
    await refreshOperatorAnalytics()

    if (surface !== "sidepanel" && surface !== "inpage" && typeof window.initExtensionPhase2 === "function") {
      window.initExtensionPhase2({
        apiBaseUrl,
        readFormValues,
        getDetected: () => state.detected,
        getCrmContext: () => state.crmContext,
        getExistingLeadId: () => state.existingLead?.lead_id ?? null,
        setStatus,
      })
    }

    if ((surface === "sidepanel" || surface === "inpage") && typeof window.initExtensionCopilot === "function") {
      const copilot = window.initExtensionCopilot({
        apiBaseUrl,
        readFormValues,
        getDetected: () => state.detected,
        getCrmContext: () => state.crmContext,
        getExistingLeadId: () => state.existingLead?.lead_id ?? state.crmContext?.lead_id ?? null,
        getLinkedInPageKind: () => state.linkedinPageKind,
        setStatus,
        appendLeadNote,
        refreshCrmContext: async () => {
          invalidateLookupCache()
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
          const crmPayload = await fetchCrmContext(readFormValues(), tabs[0]?.url, { bypassCache: true })
          renderLinkedInStatusPanel(crmPayload, tabs[0]?.url)
        },
      })
      window.__equipifyCopilotHooks = {
        onCrmContextUpdated: () => {
          copilot?.updateCommitteeTabVisibility?.()
          copilot?.renderRelationshipMap?.()
          copilot?.renderTimeline?.()
        },
        refreshAnalytics: () => copilot?.refreshAnalytics?.(),
        switchTab: (tabId) => copilot?.switchTab?.(tabId),
      }

      window.EquipifySalesWorkspace?.wireActions?.({
        refresh: async () => {
          invalidateLookupCache()
          await bootstrap()
        },
        submitCapture: () => saveIntake(),
      })
    }

    window.__equipifySaveIntake = saveIntake

    if (surface === "inpage") {
      window.parent.postMessage({ type: "equipify-inpage-sidebar-ready" }, "*")
      scheduleBootstrap()
    } else {
      await bootstrap()
    }
  }

  init().catch((error) => {
    logError("init_failed", error)
    setLoadingState(false)
    showFallbackError("Could not read this page. Reload LinkedIn or re-open Equipify Sales.")
  })
}

window.initEquipifyGrowthIntakeApp = initIntakeApp
