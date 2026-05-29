const API_BASE = "https://app.equipify.ai"
const INTAKE_PATH = "/api/platform/growth/browser-intake/contact"
const LOOKUP_PATH = "/api/platform/growth/browser-intake/lookup"

const state = {
  mode: "quick",
  intakeMode: "default",
  targetLeadId: null,
  existingLead: null,
  detected: null,
}

const els = {
  captureStatus: document.getElementById("capture-status"),
  detectedPanel: document.getElementById("detected-panel"),
  detectedCompany: document.getElementById("detected-company"),
  detectedPlatform: document.getElementById("detected-platform"),
  detectedDomain: document.getElementById("detected-domain"),
  existingLeadPanel: document.getElementById("existing-lead-panel"),
  existingLeadSummary: document.getElementById("existing-lead-summary"),
  contextWarning: document.getElementById("context-warning"),
  quickFields: document.getElementById("quick-fields"),
  fullFields: document.getElementById("full-fields"),
  quickModeBtn: document.getElementById("quick-mode-btn"),
  fullModeBtn: document.getElementById("full-mode-btn"),
  form: document.getElementById("intake-form"),
  submitBtn: document.getElementById("submit-btn"),
  status: document.getElementById("status"),
  leadLinkWrap: document.getElementById("lead-link-wrap"),
  leadLink: document.getElementById("lead-link"),
  openLeadBtn: document.getElementById("open-lead-btn"),
  updateLeadBtn: document.getElementById("update-lead-btn"),
  createAnywayBtn: document.getElementById("create-anyway-btn"),
}

function trimOrNull(value) {
  const trimmed = (value ?? "").trim()
  return trimmed ? trimmed : null
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
  return `${API_BASE}/admin/growth/leads/${leadId}`
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
    company_name: trimOrNull(document.getElementById("company-name").value),
    contact_name: trimOrNull(document.getElementById("contact-name").value),
    title: trimOrNull(document.getElementById("title").value),
    email: trimOrNull(document.getElementById("email").value),
    phone: trimOrNull(document.getElementById("phone").value),
    website: trimOrNull(document.getElementById("website").value),
    linkedin_url: trimOrNull(document.getElementById("linkedin-url").value),
    source_url: trimOrNull(document.getElementById("source-url").value),
    source_platform: document.getElementById("source-platform-input").value || "website",
    page_title: trimOrNull(document.getElementById("page-title-input").value),
    notes: trimOrNull(document.getElementById("notes").value),
    queue_contact_discovery: document.getElementById("queue-discovery").checked,
    capture_method: "chrome_extension",
    intake_mode: document.getElementById("intake-mode-input").value || "default",
    target_lead_id: trimOrNull(document.getElementById("target-lead-id-input").value),
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

  document.getElementById("source-url").value = sourceUrl ?? ""
  document.getElementById("source-platform-input").value = platform
  document.getElementById("page-title-input").value = pageTitle ?? ""

  if (companyName) document.getElementById("company-name").value = companyName
  if (website) document.getElementById("website").value = website
  if (linkedinUrl) document.getElementById("linkedin-url").value = linkedinUrl

  if (companyName) {
    els.detectedPanel.hidden = false
    els.detectedCompany.textContent = companyName
    els.detectedPlatform.textContent = platform
    els.detectedDomain.textContent = website || linkedinUrl || sourceUrl || ""
  } else {
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

async function lookupExistingLead(payload) {
  const params = new URLSearchParams()
  if (payload.company_name) params.set("company_name", payload.company_name)
  if (payload.website) params.set("website", payload.website)
  if (payload.linkedin_url) params.set("linkedin_url", payload.linkedin_url)

  if ([...params.keys()].length === 0) return null

  const response = await fetch(`${API_BASE}${LOOKUP_PATH}?${params.toString()}`, {
    method: "GET",
    credentials: "include",
  })

  const body = await response.json().catch(() => null)
  if (!response.ok || !body?.ok) return null
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
}

function setIntakeMode(mode, targetLeadId = null) {
  state.intakeMode = mode
  state.targetLeadId = targetLeadId
  document.getElementById("intake-mode-input").value = mode
  document.getElementById("target-lead-id-input").value = targetLeadId ?? ""
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
  els.status.hidden = false
  els.status.textContent = message
  els.status.className = `message message-${type}`
}

function clearStatus() {
  els.status.hidden = true
  els.status.textContent = ""
  els.leadLinkWrap.hidden = true
}

function formatApiError(status, payload) {
  if (status === 403) {
    if (payload?.error === "feature_disabled") return "Growth Engine is disabled."
    return "Sign in to app.equipify.ai as a platform admin."
  }
  if (status === 409) {
    const reason = payload?.result?.reason ?? payload?.message
    return reason ? `Suppressed: ${reason}` : "Contact suppressed."
  }
  return payload?.result?.message ?? payload?.message ?? payload?.error ?? `Request failed (${status}).`
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

    const formValues = readFormValues()
    const lookup = await lookupExistingLead(formValues)
    showExistingLead(lookup?.best_match ?? null)

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
    const response = await fetch(`${API_BASE}${INTAKE_PATH}`, {
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

    if (result.lead_id) {
      els.leadLink.href = leadAdminUrl(result.lead_id)
      els.leadLinkWrap.hidden = false
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network error"
    setStatus(`Could not reach Equipify (${message}).`, "error")
    setCaptureStatus("Error", "status-error")
  } finally {
    els.submitBtn.disabled = false
  }
}

els.quickModeBtn.addEventListener("click", () => setMode("quick"))
els.fullModeBtn.addEventListener("click", () => setMode("full"))
els.form.addEventListener("submit", submitIntake)

els.openLeadBtn.addEventListener("click", () => {
  if (!state.existingLead?.lead_id) return
  chrome.tabs.create({ url: leadAdminUrl(state.existingLead.lead_id) })
})

els.updateLeadBtn.addEventListener("click", () => {
  if (!state.existingLead?.lead_id) return
  setIntakeMode("update_existing", state.existingLead.lead_id)
  setStatus("Will update the existing lead on save.", "success")
})

els.createAnywayBtn.addEventListener("click", () => {
  setIntakeMode("create_new", null)
  els.existingLeadPanel.hidden = true
  setStatus("Will create a new lead on save.", "success")
})

setMode("quick")
bootstrap()
