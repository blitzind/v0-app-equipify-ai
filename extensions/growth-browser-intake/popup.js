const API_BASE = "https://app.equipify.ai"
const INTAKE_PATH = "/api/platform/growth/browser-intake/contact"

const form = document.getElementById("intake-form")
const submitBtn = document.getElementById("submit-btn")
const statusEl = document.getElementById("status")
const leadLinkWrap = document.getElementById("lead-link-wrap")
const leadLink = document.getElementById("lead-link")
const contextSection = document.getElementById("context")
const contextWarning = document.getElementById("context-warning")
const sourcePlatformBadge = document.getElementById("source-platform")
const sourceUrlLink = document.getElementById("source-url-link")
const sourceUrlInput = document.getElementById("source-url")
const sourcePlatformInput = document.getElementById("source-platform-input")

function trimOrNull(value) {
  const trimmed = (value ?? "").trim()
  return trimmed ? trimmed : null
}

function detectSourcePlatform(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    if (hostname.includes("linkedin.com")) return "linkedin"
  } catch {
    // ignore
  }
  return "website"
}

function cleanPageUrl(url) {
  try {
    const parsed = new URL(url)
    parsed.hash = ""
    return parsed.toString()
  } catch {
    return url
  }
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

function isLinkedInProfileUrl(url) {
  try {
    const parsed = new URL(url)
    return parsed.hostname.toLowerCase().includes("linkedin.com") && /\/in\//i.test(parsed.pathname)
  } catch {
    return false
  }
}

function isLinkedInCompanyUrl(url) {
  try {
    const parsed = new URL(url)
    return parsed.hostname.toLowerCase().includes("linkedin.com") && /\/company\//i.test(parsed.pathname)
  } catch {
    return false
  }
}

function pageWebsiteFromUrl(url) {
  if (isRestrictedTabUrl(url)) return null
  if (detectSourcePlatform(url) === "linkedin") return null
  try {
    const parsed = new URL(url)
    if (!/^https?:$/i.test(parsed.protocol)) return null
    return `${parsed.protocol}//${parsed.host}`
  } catch {
    return null
  }
}

function hasContactData(payload) {
  return Boolean(
    trimOrNull(payload.contact_name) ||
      trimOrNull(payload.email) ||
      trimOrNull(payload.phone) ||
      trimOrNull(payload.linkedin_url),
  )
}

function setStatus(message, type) {
  statusEl.hidden = false
  statusEl.textContent = message
  statusEl.className = `message message-${type}`
}

function clearStatus() {
  statusEl.hidden = true
  statusEl.textContent = ""
  statusEl.className = "message"
  leadLinkWrap.hidden = true
}

function setSubmitting(isSubmitting) {
  submitBtn.disabled = isSubmitting
  submitBtn.textContent = isSubmitting ? "Sending…" : "Send to Equipify"
}

function applyTabContext(tab) {
  const url = tab?.url ?? ""
  const platform = detectSourcePlatform(url)
  const cleanedUrl = cleanPageUrl(url)

  sourcePlatformBadge.textContent = platform
  sourcePlatformInput.value = platform

  if (isRestrictedTabUrl(url)) {
    contextSection.hidden = true
    contextWarning.hidden = false
    contextWarning.textContent =
      "Open a regular website or LinkedIn page, then click the extension again to capture the page URL."
    sourceUrlInput.value = ""
    return
  }

  contextSection.hidden = false
  contextWarning.hidden = true
  sourceUrlInput.value = cleanedUrl
  sourceUrlLink.href = cleanedUrl
  sourceUrlLink.textContent = cleanedUrl

  const linkedinInput = document.getElementById("linkedin-url")
  const websiteInput = document.getElementById("website")

  if (isLinkedInProfileUrl(cleanedUrl) || isLinkedInCompanyUrl(cleanedUrl)) {
    if (!trimOrNull(linkedinInput.value)) {
      linkedinInput.value = cleanedUrl
    }
  }

  const website = pageWebsiteFromUrl(cleanedUrl)
  if (website && !trimOrNull(websiteInput.value)) {
    websiteInput.value = website
  }
}

async function loadActiveTabContext() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    applyTabContext(tabs[0])
  } catch {
    contextSection.hidden = true
    contextWarning.hidden = false
    contextWarning.textContent = "Could not read the active tab URL."
  }
}

function buildPayload() {
  return {
    company_name: trimOrNull(document.getElementById("company-name").value),
    contact_name: trimOrNull(document.getElementById("contact-name").value),
    title: trimOrNull(document.getElementById("title").value),
    email: trimOrNull(document.getElementById("email").value),
    phone: trimOrNull(document.getElementById("phone").value),
    website: trimOrNull(document.getElementById("website").value),
    linkedin_url: trimOrNull(document.getElementById("linkedin-url").value),
    source_url: trimOrNull(sourceUrlInput.value),
    source_platform: sourcePlatformInput.value || "website",
    notes: trimOrNull(document.getElementById("notes").value),
  }
}

function leadAdminUrl(leadId) {
  return `${API_BASE}/admin/growth/leads/${leadId}`
}

function formatApiError(status, payload) {
  if (status === 403) {
    if (payload?.error === "feature_disabled") {
      return "Growth Engine is disabled on this deployment."
    }
    return "Not authorized. Sign in to app.equipify.ai as a platform admin, then try again."
  }
  if (status === 409) {
    const reason = payload?.result?.reason ?? payload?.message
    return reason ? `Suppressed: ${reason}` : "Contact was suppressed and not imported."
  }
  if (status === 400) {
    return payload?.message ?? "Invalid form data."
  }
  if (payload?.result?.message) {
    return payload.result.message
  }
  return payload?.message ?? payload?.error ?? `Request failed (${status}).`
}

async function submitIntake(event) {
  event.preventDefault()
  clearStatus()

  const payload = buildPayload()

  if (!payload.company_name) {
    setStatus("Company name is required.", "error")
    return
  }

  if (!hasContactData(payload)) {
    setStatus("Add at least one contact field: name, email, phone, or LinkedIn URL.", "error")
    return
  }

  setSubmitting(true)

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
      return
    }

    if (result.status === "created") {
      setStatus("Lead created in Equipify Growth Engine.", "success")
    } else if (result.status === "updated") {
      setStatus("Matched an existing lead and updated empty fields.", "success")
    } else {
      setStatus(`Intake completed with status: ${result.status}.`, "success")
    }

    if (result.lead_id) {
      leadLink.href = leadAdminUrl(result.lead_id)
      leadLinkWrap.hidden = false
    }

    if (Array.isArray(result.warnings) && result.warnings.length > 0) {
      const warningText = result.warnings.map((w) => w.message).join(" ")
      setStatus(`${statusEl.textContent} ${warningText}`, "success")
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network error"
    setStatus(`Could not reach Equipify (${message}). Check your connection and sign-in.`, "error")
  } finally {
    setSubmitting(false)
  }
}

form.addEventListener("submit", submitIntake)
loadActiveTabContext()
