/**
 * Shared Growth intake UI for popup and side panel.
 * Uses visible page metadata only — no hidden scraping, messaging, or outreach.
 */

function initIntakeApp(options) {
  const surface = options?.surface === "sidepanel" ? "sidepanel" : "popup"
  const config = window.EquipifyGrowthExtensionConfig
  const storage = window.EquipifyGrowthExtensionStorage
  const linkedinContext = window.EquipifyGrowthLinkedInContext
  const linkedinStatus = window.EquipifyGrowthLinkedInStatus

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
    saveSettingsBtn: document.getElementById("save-settings-btn"),
    settingsStatus: document.getElementById("settings-status"),
    recentCapturesPanel: document.getElementById("recent-captures-panel"),
    recentCapturesList: document.getElementById("recent-captures-list"),
    openSidePanelBtn: document.getElementById("open-side-panel-btn"),
    signInLink: document.getElementById("sign-in-link"),
    extensionBuildMeta: document.getElementById("extension-build-meta"),
    linkedinStatusPanel: document.getElementById("linkedin-status-panel"),
    linkedinStatusBadge: document.getElementById("linkedin-status-badge"),
    linkedinStatusContext: document.getElementById("linkedin-status-context"),
    linkedinStatusMatch: document.getElementById("linkedin-status-match"),
    linkedinAddBtn: document.getElementById("linkedin-add-btn"),
    linkedinOpenLeadBtn: document.getElementById("linkedin-open-lead-btn"),
    linkedinUpdateLeadBtn: document.getElementById("linkedin-update-lead-btn"),
    linkedinMarkReviewedBtn: document.getElementById("linkedin-mark-reviewed-btn"),
  }

  function trimOrNull(value) {
    const trimmed = (value ?? "").trim()
    return trimmed ? trimmed : null
  }

  function apiBaseUrl() {
    return state.settings.apiBaseUrl || config.EXTENSION_API_PRESETS.production
  }

  function setCaptureStatus(text, className) {
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
      notes: trimOrNull(document.getElementById("notes")?.value),
      queue_contact_discovery: state.settings.queueContactDiscovery,
      verify_email: state.settings.verifyEmailBeforeSave,
      capture_method: "chrome_extension",
      intake_mode: document.getElementById("intake-mode-input")?.value || "default",
      target_lead_id: trimOrNull(document.getElementById("target-lead-id-input")?.value),
    }
  }

  function applyDetectedMetadata(metadata, tabUrl) {
    state.detected = metadata
    const companyName = trimOrNull(metadata?.company_name)
    const website = trimOrNull(metadata?.website)
    const linkedinUrl = trimOrNull(metadata?.linkedin_url)
    const sourceUrl = trimOrNull(metadata?.source_url) || trimOrNull(tabUrl)
    const platform = metadata?.source_platform || "website"
    const pageTitle = trimOrNull(metadata?.page_title)

    const sourceUrlInput = document.getElementById("source-url")
    const platformInput = document.getElementById("source-platform-input")
    const pageTitleInput = document.getElementById("page-title-input")
    const companyInput = document.getElementById("company-name")
    const websiteInput = document.getElementById("website")
    const linkedinInput = document.getElementById("linkedin-url")

    if (sourceUrlInput) sourceUrlInput.value = sourceUrl ?? ""
    if (platformInput) platformInput.value = platform
    if (pageTitleInput) pageTitleInput.value = pageTitle ?? ""
    if (companyName && companyInput) companyInput.value = companyName
    if (website && websiteInput) websiteInput.value = website
    if (linkedinUrl && linkedinInput) linkedinInput.value = linkedinUrl

    if (companyName) {
      els.detectedPanel.hidden = false
      els.detectedCompany.textContent = companyName
      els.detectedPlatform.textContent = platform
      els.detectedDomain.textContent = website || linkedinUrl || sourceUrl || ""
    } else if (els.detectedPanel) {
      els.detectedPanel.hidden = true
    }
  }

  async function extractTabMetadata(tab) {
    if (!tab?.id || isRestrictedTabUrl(tab.url)) return null

    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["page-metadata.js"],
      })

      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.__equipifyGrowthExtract?.() ?? null,
      })

      return result ?? null
    } catch {
      return null
    }
  }

  async function lookupExistingLead(payload, tabUrl) {
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

    if ([...params.keys()].length === 0) return null

    const response = await fetch(`${apiBaseUrl()}${config.LOOKUP_PATH}?${params.toString()}`, {
      method: "GET",
      credentials: "include",
    })

    const body = await response.json().catch(() => null)
    if (!response.ok || !body?.ok) return null
    return body
  }

  function renderLinkedInStatusPanel(lookup, tabUrl) {
    if (!els.linkedinStatusPanel || !linkedinStatus) return

    state.linkedinLookup = lookup
    state.linkedinPageKind =
      lookup?.linkedin_page_kind ?? linkedinContext?.detectLinkedInPageKind(tabUrl) ?? null

    const status = linkedinStatus.resolveStatusFromLookup(lookup)
    const matched = status.match

    els.linkedinStatusBadge.textContent = status.extensionLabel
    els.linkedinStatusBadge.className = `linkedin-status-badge badge-${status.tone}`

    const contextParts = []
    if (state.linkedinPageKind === "profile") contextParts.push("LinkedIn profile")
    if (state.linkedinPageKind === "company") contextParts.push("LinkedIn company")
    if (matched?.company_name) contextParts.push(matched.company_name)
    els.linkedinStatusContext.textContent = contextParts.join(" · ")

    els.linkedinStatusMatch.textContent = status.matchSummary ?? ""
    els.linkedinStatusMatch.hidden = !status.matchSummary

    const hasMatch = Boolean(matched?.lead_id)
    els.linkedinOpenLeadBtn.hidden = !hasMatch
    els.linkedinUpdateLeadBtn.hidden = !hasMatch
    els.linkedinMarkReviewedBtn.hidden = !hasMatch || matched?.review_status === "reviewed"

    if (hasMatch) {
      state.existingLead = matched
      showExistingLead(matched)
    } else {
      state.existingLead = null
      if (els.existingLeadPanel) els.existingLeadPanel.hidden = true
    }
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
      els.existingLeadPanel.hidden = true
      state.existingLead = null
      return
    }

    state.existingLead = match
    els.existingLeadPanel.hidden = false
    els.existingLeadSummary.textContent = `${match.company_name}${match.website ? ` · ${match.website}` : ""}`
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
    els.quickModeBtn.classList.toggle("active", quick)
    els.fullModeBtn.classList.toggle("active", !quick)
    els.quickFields.hidden = !quick
    els.fullFields.hidden = quick
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
    els.successSummary.textContent = `${company}${contact}`

    els.successOpenLeadBtn.onclick = () => {
      chrome.tabs.create({ url: leadAdminUrl(saveRecord.lead_id) })
    }
    els.successCapturedLink.href = capturedLeadsUrl()
    els.successEmailStatus.textContent = config.formatEmailStatus(
      saveRecord.email_status,
      saveRecord.verified_by_provider,
    )
    els.successDiscoveryStatus.textContent = config.formatDiscoveryStatus(
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
    }
    await storage.saveExtensionSettings(nextSettings)
    state.settings = nextSettings
    if (els.settingsStatus) {
      els.settingsStatus.hidden = false
      els.settingsStatus.textContent = "Settings saved."
      els.settingsStatus.className = "message message-success"
    }
    if (els.signInLink) els.signInLink.href = signInUrl()
  }

  async function bootstrap() {
    setCaptureStatus("Detecting", "status-detecting")
    clearStatus()

    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
      const tab = tabs[0]

      if (isRestrictedTabUrl(tab?.url)) {
        els.contextWarning.hidden = false
        els.contextWarning.textContent = "Open a website or LinkedIn page, then reopen the extension."
        setCaptureStatus("No page", "status-error")
        return
      }

      els.contextWarning.hidden = true
      const metadata = await extractTabMetadata(tab)
      applyDetectedMetadata(metadata, tab?.url)

      const linkedinQuery = linkedinContext?.buildLinkedInLookupQuery({
        url: tab?.url,
        page_title: metadata?.page_title ?? document.title,
        company_name: metadata?.company_name,
        website: metadata?.website,
        linkedin_url: metadata?.linkedin_url,
      })
      if (linkedinQuery?.contact_name) {
        const contactInput = document.getElementById("contact-name")
        if (contactInput && !trimOrNull(contactInput.value)) {
          contactInput.value = linkedinQuery.contact_name
        }
      }

      const formValues = readFormValues()
      formValues.page_title = metadata?.page_title ?? formValues.page_title
      const lookup = await lookupExistingLead(formValues, tab?.url)
      renderLinkedInStatusPanel(lookup, tab?.url)

      setCaptureStatus("Ready", "status-ready")
    } catch {
      setCaptureStatus("Error", "status-error")
      els.contextWarning.hidden = false
      els.contextWarning.textContent = "Could not detect page metadata."
    }
  }

  async function submitIntake(event) {
    event.preventDefault()
    clearStatus()

    const payload = readFormValues()
    const companyName = payload.company_name || state.detected?.company_name

    if (!companyName) {
      setStatus("Company name is required.", "error")
      setCaptureStatus("Error", "status-error")
      return
    }

    payload.company_name = companyName
    const companyOnly = !hasContactPayload(payload)

    if (!companyOnly && !hasContactPayload(payload)) {
      setStatus("Add contact info or use company-only capture.", "error")
      return
    }

    if (companyOnly) {
      payload.company_only = true
    }

    els.submitBtn.disabled = true
    setCaptureStatus("Saving", "status-saving")

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
        setStatus(formatApiError(response.status, body), "error")
        setCaptureStatus("Error", "status-error")
        return
      }

      let message = "Saved to Equipify."
      if (result.status === "created") message = "Lead created."
      if (result.status === "updated") message = "Existing lead updated."
      if (result.capture_type === "company_only") message += " Company prospect saved."
      if (result.contact_discovery_queued) message += " Contact discovery queued."

      setStatus(message, "success")
      setCaptureStatus("Saved", "status-success")

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

      const refreshLookup = await lookupExistingLead(readFormValues(), trimOrNull(document.getElementById("source-url")?.value))
      renderLinkedInStatusPanel(refreshLookup, trimOrNull(document.getElementById("source-url")?.value))
    } catch (error) {
      const message = error instanceof Error ? error.message : "Network error"
      setStatus(`Could not reach Equipify (${message}).`, "error")
      setCaptureStatus("Error", "status-error")
    } finally {
      els.submitBtn.disabled = false
    }
  }

  function formatBuildMetadata(metadata) {
    const parts = [`v${metadata.extension_version}`]
    if (metadata.generated_at) {
      const when = new Date(metadata.generated_at)
      if (!Number.isNaN(when.getTime())) {
        parts.push(`packaged ${when.toLocaleString()}`)
      }
    }
    if (metadata.git_sha) parts.push(metadata.git_sha)
    return parts.join(" · ")
  }

  async function loadBuildMetadata() {
    if (!els.extensionBuildMeta) return

    try {
      const response = await fetch(chrome.runtime.getURL("package-metadata.json"))
      if (response.ok) {
        const metadata = await response.json()
        if (metadata?.extension_version) {
          els.extensionBuildMeta.textContent = formatBuildMetadata(metadata)
          return
        }
      }
    } catch {
      // Fall back to manifest version for unpacked local installs.
    }

    try {
      const manifest = chrome.runtime.getManifest()
      els.extensionBuildMeta.textContent = manifest?.version ? `v${manifest.version} · local unpackaged` : ""
    } catch {
      els.extensionBuildMeta.textContent = ""
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
    })

    document.getElementById("create-anyway-btn")?.addEventListener("click", () => {
      setIntakeMode("create_new", null)
      els.existingLeadPanel.hidden = true
      setStatus("Will create a new lead on save.", "success")
    })

    els.successDismissBtn?.addEventListener("click", hideSuccessPanel)

    els.settingsToggleBtn?.addEventListener("click", () => {
      if (!els.settingsPanel) return
      els.settingsPanel.hidden = !els.settingsPanel.hidden
    })

    els.saveSettingsBtn?.addEventListener("click", () => {
      saveSettingsFromUi().catch(() => {
        if (els.settingsStatus) {
          els.settingsStatus.hidden = false
          els.settingsStatus.textContent = "Could not save settings."
          els.settingsStatus.className = "message message-error"
        }
      })
    })

    els.openSidePanelBtn?.addEventListener("click", async () => {
      if (!chrome.sidePanel?.open) return
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
      const windowId = tabs[0]?.windowId
      if (windowId != null) {
        await chrome.sidePanel.open({ windowId })
      }
    })

    els.linkedinAddBtn?.addEventListener("click", () => {
      els.form?.scrollIntoView({ behavior: "smooth", block: "start" })
      els.submitBtn?.focus()
      setStatus("Review the capture form, then save to Equipify.", "success")
    })

    els.linkedinOpenLeadBtn?.addEventListener("click", () => {
      const leadId = state.existingLead?.lead_id ?? state.linkedinLookup?.best_match?.lead_id
      if (!leadId) return
      chrome.tabs.create({ url: leadAdminUrl(leadId) })
    })

    els.linkedinUpdateLeadBtn?.addEventListener("click", () => {
      const leadId = state.existingLead?.lead_id ?? state.linkedinLookup?.best_match?.lead_id
      if (!leadId) return
      setIntakeMode("update_existing", leadId)
      setStatus("Will update the existing lead on save.", "success")
      els.form?.scrollIntoView({ behavior: "smooth", block: "start" })
    })

    els.linkedinMarkReviewedBtn?.addEventListener("click", () => {
      const leadId = state.existingLead?.lead_id ?? state.linkedinLookup?.best_match?.lead_id
      if (!leadId) return
      els.linkedinMarkReviewedBtn.disabled = true
      markLeadReviewed(leadId)
        .then(async () => {
          setStatus("Lead marked reviewed.", "success")
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
          const lookup = await lookupExistingLead(readFormValues(), tabs[0]?.url)
          renderLinkedInStatusPanel(lookup, tabs[0]?.url)
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : "Could not mark reviewed."
          setStatus(message, "error")
        })
        .finally(() => {
          els.linkedinMarkReviewedBtn.disabled = false
        })
    })

    if (surface === "sidepanel") {
      chrome.tabs.onActivated.addListener(() => {
        bootstrap().catch(() => {})
      })
      chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
        if (changeInfo.status === "complete") {
          chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
            if (tabs[0]?.id === tabId) bootstrap().catch(() => {})
          })
        }
      })
    }
  }

  async function init() {
    document.body.dataset.surface = surface
    if (surface === "sidepanel") {
      document.body.classList.add("surface-sidepanel")
    } else {
      document.body.classList.add("surface-popup")
    }

    wireEvents()
    setMode("quick")
    await applySettingsToUi()
    await loadBuildMetadata()
    await refreshRecentCaptures()
    await bootstrap()
  }

  init().catch(() => {
    setCaptureStatus("Error", "status-error")
    setStatus("Extension failed to initialize.", "error")
  })
}

window.initEquipifyGrowthIntakeApp = initIntakeApp
