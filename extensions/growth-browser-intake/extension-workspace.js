/**
 * Equipify Sales workspace renderer — Prospeo-style prospecting side panel.
 */
;(function initEquipifySalesWorkspace() {
  const linkedinStatus = window.EquipifyGrowthLinkedInStatus
  const crmContextUi = window.EquipifyGrowthCrmContext
  const config = window.EquipifyGrowthExtensionConfig
  let lastRenderInput = null
  let lastEnrichmentResult = null
  let lastEmployeeRows = []
  let similarState = { seedKey: null, loading: false, matches: [] }

  function trimOrNull(value) {
    const trimmed = (value ?? "").trim()
    return trimmed ? trimmed : null
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
  }

  function initials(name) {
    const parts = (name ?? "").trim().split(/\s+/).filter(Boolean)
    if (!parts.length) return "?"
    return parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("")
  }

  function formatWhen(value) {
    if (!value) return "—"
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  }

  function inferVerificationStatus(input) {
    const status = (input?.verification_status ?? input?.email_status ?? "").toLowerCase()
    if (status.includes("verified") || status === "valid") return "verified"
    if (status.includes("risk") || status.includes("invalid")) return "risky"
    if (status.includes("unknown")) return "unknown"
    if (status) return "not_verified"
    return "unknown"
  }

  function verificationLabel(status) {
    if (status === "verified") return "Verified"
    if (status === "risky") return "Risky"
    if (status === "not_verified") return "Not Verified"
    return "Unknown"
  }

  function resolveNextBestAction(context, crmPayload, hasMatch) {
    if (context?.next_action?.label) {
      return {
        label: context.next_action.label,
        reason: context.next_action.reason ?? null,
        cta: context.next_action.label,
        action: context.next_action.key ?? "default",
      }
    }

    if (!hasMatch) {
      return {
        label: "Add Contact",
        reason: "This prospect is not in Equipify yet.",
        cta: "Add to Equipify",
        action: "add_contact",
      }
    }

    if (crmPayload?.status_badge === "needs_review" || context?.status_badge === "needs_review") {
      return {
        label: "Review Lead",
        reason: "Matched lead needs operator review.",
        cta: "Mark Reviewed",
        action: "mark_reviewed",
      }
    }

    if (context?.opportunity?.id) {
      return {
        label: "Open Opportunity",
        reason: context.opportunity.status_summary ?? "Active opportunity in pipeline.",
        cta: "Open Opportunity",
        action: "open_opportunity",
      }
    }

    return {
      label: "Call Prospect",
      reason: context?.last_activity?.summary ?? "Continue outreach on this lead.",
      cta: "Open Lead",
      action: "open_lead",
    }
  }

  function setText(id, text) {
    const el = document.getElementById(id)
    if (!el) return
    el.textContent = text ?? ""
  }

  function setHtml(id, html) {
    const el = document.getElementById(id)
    if (!el) return
    el.innerHTML = html
  }

  function apiBaseUrl() {
    const preset = document.getElementById("api-preset-select")?.value === "local" ? "local" : "production"
    return config?.EXTENSION_API_PRESETS?.[preset] ?? "https://app.equipify.ai"
  }

  const ENRICHMENT_SETUP_MESSAGE =
    "Connect an enrichment provider to find email/phone. Configure People Data Labs or website contact discovery in Equipify Growth settings."

  function setEnrichmentStatus(message, kind = "empty") {
    const statusEl = document.getElementById("es-ws-enrichment-status")
    if (!statusEl) return
    statusEl.className = kind === "error" ? "es-ws-enrichment-status es-ws-enrichment-status--error" : "es-ws-enrichment-status"
    statusEl.textContent = message
  }

  function uniqueValues(values) {
    return [...new Set(values.map((value) => trimOrNull(value)).filter(Boolean))].sort()
  }

  function inferDepartment(title) {
    const raw = (title ?? "").toLowerCase()
    if (/sales|revenue|business development|account/.test(raw)) return "Sales"
    if (/operation|coo|service|field/.test(raw)) return "Operations"
    if (/engineer|technical|biomed|technician/.test(raw)) return "Technical"
    if (/marketing|growth/.test(raw)) return "Marketing"
    if (/finance|accounting|cfo/.test(raw)) return "Finance"
    if (/owner|founder|chief|president|ceo|executive/.test(raw)) return "Executive"
    return "Unknown"
  }

  function inferSeniority(title) {
    const raw = (title ?? "").toLowerCase()
    if (/owner|founder|chief|ceo|coo|cfo|president/.test(raw)) return "Executive"
    if (/vp|vice president|director|head/.test(raw)) return "Leadership"
    if (/manager|lead|supervisor/.test(raw)) return "Manager"
    if (/engineer|technician|specialist|coordinator|rep/.test(raw)) return "Individual Contributor"
    return "Unknown"
  }

  function buildCompanySeed(input = lastRenderInput) {
    const context = input?.crmPayload?.context ?? null
    const detected = input?.detected ?? {}
    const form = input?.formValues ?? {}
    return {
      lead_id: context?.lead_id ?? null,
      company_name: context?.company_name || form.company_name || detected.company_name || null,
      website: form.website || detected.website || null,
      linkedin_url: form.linkedin_url || detected.linkedin_url || null,
      email: form.email || null,
      industry: detected.industry ?? null,
      state: detected.state ?? null,
      city: detected.city ?? null,
    }
  }

  function renderProfilePhoto(name, photoUrl) {
    const wrap = document.getElementById("es-ws-profile-photo-wrap")
    if (!wrap) return
    wrap.replaceChildren()

    if (photoUrl) {
      const img = document.createElement("img")
      img.className = "es-ws-profile-photo"
      img.src = photoUrl
      img.alt = name ? `${name} profile photo` : "Profile photo"
      wrap.appendChild(img)
      return
    }

    const placeholder = document.createElement("div")
    placeholder.className = "es-ws-profile-photo es-ws-profile-photo--placeholder"
    placeholder.textContent = initials(name)
    wrap.appendChild(placeholder)
  }

  function renderTimeline(context) {
    const container = document.getElementById("es-ws-activity-list")
    if (!container) return

    const events = context?.timeline_preview ?? []
    if (!events.length) {
      container.innerHTML = '<p class="es-ws-empty">No recent activity yet.</p>'
      return
    }

    container.innerHTML = events
      .slice(0, 5)
      .map(
        (event) => `
        <div class="es-ws-timeline-item">
          <div class="es-ws-timeline-when">${escapeHtml(formatWhen(event.occurred_at))}</div>
          <div>
            <div class="es-ws-timeline-title">${escapeHtml(event.title ?? event.event_type ?? "Activity")}</div>
            ${event.summary ? `<div class="es-ws-timeline-summary">${escapeHtml(event.summary)}</div>` : ""}
          </div>
        </div>`,
      )
      .join("")
  }

  function renderResearchSnapshot(context, detected) {
    const summaryEl = document.getElementById("es-ws-research-summary")
    const signalsEl = document.getElementById("es-ws-research-signals")
    if (!summaryEl || !signalsEl) return

    const parts = []
    if (context?.lead_status_label) parts.push(`Status: ${context.lead_status_label}.`)
    if (context?.next_action?.label) parts.push(`Suggested: ${context.next_action.label}.`)
    if (context?.lead_score != null) parts.push(`Lead score ${context.lead_score}.`)

    const summary =
      parts.slice(0, 3).join(" ") ||
      (detected?.company_name
        ? `${detected.company_name} detected from visible page metadata. Capture to enrich in Equipify.`
        : "Capture this page to build a research snapshot in Equipify.")

    summaryEl.textContent = summary

    const signals = []
    if (detected?.source_platform === "linkedin") signals.push("LinkedIn")
    if (context?.company_contacts_count) signals.push(`${context.company_contacts_count} contacts`)
    if (context?.related_leads_count) signals.push(`${context.related_leads_count} related leads`)
    if (context?.opportunity?.stage_label) signals.push(context.opportunity.stage_label)

    signalsEl.innerHTML = signals.length
      ? signals.map((signal) => `<span class="es-ws-signal">${escapeHtml(signal)}</span>`).join("")
      : '<span class="es-ws-signal">Awaiting capture</span>'
  }

  function renderQueueShortcuts(recentCaptures) {
    const recentEl = document.getElementById("es-ws-queue-recent-count")
    if (recentEl) recentEl.textContent = String(recentCaptures?.length ?? 0)
  }

  function renderEmployees(context) {
    const list = document.getElementById("es-ws-employees-list")
    if (!list) return

    const relationshipMap = context?.company_relationship_map ?? {}
    lastEmployeeRows = [
      ...(relationshipMap.contacts ?? []),
      ...(relationshipMap.related_leads ?? []),
    ].map((contact) => ({
      ...contact,
      department: contact.department ?? inferDepartment(contact.title),
      seniority: contact.seniority ?? inferSeniority(contact.title),
      crm_status: contact.status ? contact.status.replace(/_/g, " ") : "Not In CRM",
    }))

    populateEmployeeFilters(lastEmployeeRows)
    renderFilteredEmployees()
  }

  function populateSelect(id, values, fallbackLabel) {
    const select = document.getElementById(id)
    if (!select) return
    const current = select.value
    select.innerHTML = `<option value="">${fallbackLabel}</option>${values
      .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
      .join("")}`
    select.value = values.includes(current) ? current : ""
  }

  function populateEmployeeFilters(rows) {
    populateSelect("es-ws-employee-department-filter", uniqueValues(rows.map((row) => row.department)), "Department")
    populateSelect("es-ws-employee-seniority-filter", uniqueValues(rows.map((row) => row.seniority)), "Seniority")
    populateSelect("es-ws-employee-crm-filter", uniqueValues(rows.map((row) => row.crm_status)), "CRM status")
  }

  function renderFilteredEmployees() {
    const list = document.getElementById("es-ws-employees-list")
    if (!list) return

    const query = (document.getElementById("es-ws-employee-search")?.value ?? "").trim().toLowerCase()
    const department = document.getElementById("es-ws-employee-department-filter")?.value ?? ""
    const seniority = document.getElementById("es-ws-employee-seniority-filter")?.value ?? ""
    const crmStatus = document.getElementById("es-ws-employee-crm-filter")?.value ?? ""
    const contacts = lastEmployeeRows.filter((contact) => {
      const haystack = `${contact.name ?? ""} ${contact.title ?? ""}`.toLowerCase()
      if (query && !haystack.includes(query)) return false
      if (department && contact.department !== department) return false
      if (seniority && contact.seniority !== seniority) return false
      if (crmStatus && contact.crm_status !== crmStatus) return false
      return true
    })

    if (!contacts.length) {
      list.innerHTML = '<p class="es-ws-empty">Run contact discovery to find people at this company.</p>'
      return
    }

    list.innerHTML = contacts
      .slice(0, 6)
      .map((contact) => {
        return `
          <div class="es-ws-employee-row">
            <div>
              <div class="es-ws-employee-name">${escapeHtml(contact.name ?? "Company contact")}</div>
              <div class="es-ws-employee-title">${escapeHtml(contact.title ?? "Title unknown")}</div>
              <div class="es-ws-employee-meta">${escapeHtml(contact.department)} · ${escapeHtml(contact.seniority)} · ${escapeHtml(contact.crm_status)}</div>
            </div>
            <button type="button" class="es-ws-employee-action" data-lead-id="${escapeHtml(contact.lead_id ?? "")}">
              ${contact.lead_id ? "Open" : "Add"}
            </button>
          </div>
        `
      })
      .join("")

    list.querySelectorAll(".es-ws-employee-action").forEach((btn) => {
      btn.addEventListener("click", () => {
        const leadId = btn.dataset.leadId
        if (leadId) document.getElementById("linkedin-open-lead-btn")?.click()
        else document.getElementById("linkedin-add-btn")?.click()
      })
    })
  }

  function renderTechnologies(detected, context) {
    const list = document.getElementById("es-ws-technologies-list")
    if (!list) return
    const tech = [
      ...(Array.isArray(detected?.technologies) ? detected.technologies : []),
      ...(Array.isArray(detected?.software_stack) ? detected.software_stack : []),
      ...(Array.isArray(detected?.marketing_tools) ? detected.marketing_tools : []),
      ...(Array.isArray(detected?.analytics_tools) ? detected.analytics_tools : []),
      ...(Array.isArray(detected?.security_technologies) ? detected.security_technologies : []),
      ...(Array.isArray(context?.technology_signals) ? context.technology_signals : []),
    ]
    const values = uniqueValues(tech)
    list.innerHTML = values.length
      ? values.map((value) => `<span class="es-ws-signal">${escapeHtml(value)}</span>`).join("")
      : '<p class="es-ws-empty">No evidence-backed technologies yet. Run Research to enrich this account.</p>'
  }

  function renderSignals(detected, context) {
    const list = document.getElementById("es-ws-signals-list")
    if (!list) return
    const signals = [
      ...(Array.isArray(detected?.growth_signals) ? detected.growth_signals : []),
      ...(Array.isArray(detected?.hiring_signals) ? detected.hiring_signals : []),
      ...(Array.isArray(detected?.news_references) ? detected.news_references : []),
      context?.next_action?.reason,
      context?.opportunity?.status_summary,
    ].filter(Boolean)
    list.innerHTML = signals.length
      ? signals.map((signal) => `<div class="es-ws-signal-row">${escapeHtml(signal)}</div>`).join("")
      : '<p class="es-ws-empty">No Growth Engine signals yet. Run Research to look for public signals.</p>'
  }

  function renderCrmRelationship(context, relationship, contactsCount, oppCount, customerCount) {
    setHtml("es-ws-crm-relationship-list", `
      <div class="es-ws-kv-row"><span class="es-ws-kv-label">CRM status</span><span class="es-ws-kv-value">${escapeHtml(relationship)}</span></div>
      <div class="es-ws-kv-row"><span class="es-ws-kv-label">Owner</span><span class="es-ws-kv-value">${escapeHtml(context?.owner?.display_name || context?.owner?.email || "Unassigned")}</span></div>
      <div class="es-ws-kv-row"><span class="es-ws-kv-label">Lead score</span><span class="es-ws-kv-value">${escapeHtml(context?.lead_score ?? "—")}</span></div>
      <div class="es-ws-kv-row"><span class="es-ws-kv-label">Review</span><span class="es-ws-kv-value">${escapeHtml(context?.status_badge_label ?? "—")}</span></div>
      <div class="es-ws-kv-row"><span class="es-ws-kv-label">Opportunity</span><span class="es-ws-kv-value">${escapeHtml(context?.opportunity?.stage_label ?? (oppCount ? "Existing opportunity" : "—"))}</span></div>
      <div class="es-ws-kv-row"><span class="es-ws-kv-label">Contacts</span><span class="es-ws-kv-value">${contactsCount}</span></div>
      <div class="es-ws-kv-row"><span class="es-ws-kv-label">Customers</span><span class="es-ws-kv-value">${customerCount}</span></div>
    `)
  }

  function render(input) {
    lastRenderInput = input
    const crmPayload = input?.crmPayload ?? null
    const detected = input?.detected ?? null
    const formValues = input?.formValues ?? {}
    const recentCaptures = input?.recentCaptures ?? []
    const context = crmPayload?.context ?? null
    const hasMatch = Boolean(context?.lead_id)
    const display = linkedinStatus?.resolveProspectDisplayBadge?.(crmPayload) ?? {
      displayLabel: "Not In Equipify",
      emoji: "⚪",
      tone: "neutral",
      matchSummary: null,
    }

    const name =
      context?.contact_name ||
      trimOrNull(formValues.contact_name) ||
      trimOrNull(detected?.page_title?.split("|")[0]) ||
      "Current page"

    const title = trimOrNull(formValues.title) || "—"
    const company = context?.company_name || trimOrNull(formValues.company_name) || detected?.company_name || "—"
    const location = trimOrNull(formValues.location) || "—"
    const email = trimOrNull(formValues.email) || "—"
    const phone = trimOrNull(formValues.phone) || "—"
    const website = trimOrNull(formValues.website) || detected?.website || "—"
    const linkedinUrl = trimOrNull(formValues.linkedin_url) || detected?.linkedin_url || "—"
    const companyLinkedInUrl = detected?.linkedin_company_url ?? detected?.company_linkedin_url ?? "—"
    const seedKey = JSON.stringify(buildCompanySeed(input))
    if (similarState.seedKey !== seedKey) {
      similarState = { seedKey, loading: false, matches: [] }
      renderSimilarCompanies([])
    }

    const verification = inferVerificationStatus({
      verification_status: input?.existingLead?.verification_status,
      email_status: input?.existingLead?.email_status,
    })

    renderProfilePhoto(name, input?.profilePhotoUrl ?? null)
    setText("es-ws-profile-name", name)
    setText("es-ws-profile-title", title)
    setText("es-ws-profile-company", company)
    setText("es-ws-profile-location", location !== "—" ? location : "")

    const badgeEl = document.getElementById("es-ws-status-badge")
    if (badgeEl) {
      badgeEl.dataset.tone = display.tone
      badgeEl.innerHTML = `<span aria-hidden="true">${display.emoji}</span><span>${escapeHtml(display.displayLabel)}</span>`
    }

    const matchEl = document.getElementById("es-ws-match-confidence")
    if (matchEl) {
      matchEl.textContent = display.matchSummary ?? ""
      matchEl.hidden = !display.matchSummary
    }

    const legacyBadge = document.getElementById("linkedin-status-badge")
    if (legacyBadge) {
      legacyBadge.textContent = `${display.emoji} ${display.displayLabel}`
      legacyBadge.className = "es-ws-hidden-compat"
    }

    setHtml("es-ws-contact-rows", `
      <div class="es-ws-kv-row"><span class="es-ws-kv-label">Email</span><span class="es-ws-kv-value">${escapeHtml(email)} <button type="button" class="es-ws-copy-btn" data-copy-value="${escapeHtml(email)}" ${email === "—" ? "hidden" : ""}>Copy</button></span></div>
      <div class="es-ws-kv-row"><span class="es-ws-kv-label">Phone</span><span class="es-ws-kv-value">${escapeHtml(phone)} <button type="button" class="es-ws-copy-btn" data-copy-value="${escapeHtml(phone)}" ${phone === "—" ? "hidden" : ""}>Copy</button></span></div>
      <div class="es-ws-kv-row"><span class="es-ws-kv-label">LinkedIn</span><span class="es-ws-kv-value">${linkedinUrl !== "—" ? `<a href="${escapeHtml(linkedinUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(linkedinUrl)}</a>` : "—"}</span></div>
      <div class="es-ws-kv-row"><span class="es-ws-kv-label">Website</span><span class="es-ws-kv-value">${website !== "—" ? `<a href="${escapeHtml(website)}" target="_blank" rel="noopener noreferrer">${escapeHtml(website)}</a>` : "—"}</span></div>
      <div class="es-ws-kv-row"><span class="es-ws-kv-label">Verification</span><span class="es-ws-kv-value"><span class="es-ws-verify-pill" data-status="${verification}">${verificationLabel(verification)}</span></span></div>
    `)

    document.querySelectorAll(".es-ws-copy-btn").forEach((btn) => {
      btn.addEventListener("click", () => copyText(btn.dataset.copyValue))
    })

    const verifyBtn = document.getElementById("es-ws-verify-email-btn")
    if (verifyBtn) {
      verifyBtn.hidden = email === "—" || verification === "verified"
    }

    const relationship = linkedinStatus?.formatCompanyRelationshipStatus?.(crmPayload) ?? "Not Added"
    const contactsCount = context?.company_contacts_count ?? 0
    const oppCount = context?.opportunity?.id ? 1 : 0
    const customerCount = linkedinStatus?.isCustomerLeadStatus?.(context?.lead_status) ? 1 : 0

    const companyNameEl = document.getElementById("es-ws-company-name")
    if (companyNameEl) companyNameEl.textContent = company
    const companySubtitle = document.getElementById("es-ws-company-subtitle")
    if (companySubtitle) {
      companySubtitle.textContent = [detected?.industry, location !== "—" ? location : null]
        .filter(Boolean)
        .join(" · ") || "Evidence-backed company profile"
    }
    const companyLogo = document.getElementById("es-ws-company-logo")
    if (companyLogo) {
      const logoUrl = trimOrNull(detected?.company_logo_url)
      if (logoUrl) {
        companyLogo.innerHTML = `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(company)} logo" />`
      } else {
        companyLogo.textContent = initials(company)
      }
    }

    setHtml("es-ws-company-rows", `
      <div class="es-ws-kv-row"><span class="es-ws-kv-label">Company</span><span class="es-ws-kv-value">${escapeHtml(company)}</span></div>
      <div class="es-ws-kv-row"><span class="es-ws-kv-label">Website</span><span class="es-ws-kv-value">${website !== "—" ? `<a href="${escapeHtml(website)}" target="_blank" rel="noopener noreferrer">${escapeHtml(website)}</a>` : "—"}</span></div>
      <div class="es-ws-kv-row"><span class="es-ws-kv-label">LinkedIn</span><span class="es-ws-kv-value">${companyLinkedInUrl !== "—" ? `<a href="${escapeHtml(companyLinkedInUrl)}" target="_blank" rel="noopener noreferrer">Company page</a>` : "—"}</span></div>
      <div class="es-ws-kv-row"><span class="es-ws-kv-label">About</span><span class="es-ws-kv-value">${escapeHtml(trimOrNull(detected?.company_description) ?? "—")}</span></div>
      <div class="es-ws-kv-row"><span class="es-ws-kv-label">Location</span><span class="es-ws-kv-value">${escapeHtml(location)}</span></div>
      <div class="es-ws-kv-row"><span class="es-ws-kv-label">Offices</span><span class="es-ws-kv-value">${escapeHtml(Array.isArray(detected?.office_locations) ? detected.office_locations.join(", ") : "—")}</span></div>
      <div class="es-ws-kv-row"><span class="es-ws-kv-label">Industry</span><span class="es-ws-kv-value">${escapeHtml(trimOrNull(detected?.industry) ?? "—")}</span></div>
      <div class="es-ws-kv-row"><span class="es-ws-kv-label">Keywords</span><span class="es-ws-kv-value">${escapeHtml(Array.isArray(detected?.keywords) ? detected.keywords.join(", ") : trimOrNull(detected?.keywords) ?? "—")}</span></div>
      <div class="es-ws-kv-row"><span class="es-ws-kv-label">Sub-industry</span><span class="es-ws-kv-value">${escapeHtml(trimOrNull(detected?.subindustry) ?? "—")}</span></div>
      <div class="es-ws-kv-row"><span class="es-ws-kv-label">Employees</span><span class="es-ws-kv-value">${escapeHtml(trimOrNull(detected?.employee_count) ?? "—")}</span></div>
      <div class="es-ws-kv-row"><span class="es-ws-kv-label">Employee range</span><span class="es-ws-kv-value">${escapeHtml(trimOrNull(detected?.employee_range) ?? "—")}</span></div>
      <div class="es-ws-kv-row"><span class="es-ws-kv-label">Revenue</span><span class="es-ws-kv-value">${escapeHtml(trimOrNull(detected?.revenue) ?? "—")}</span></div>
      <div class="es-ws-kv-row"><span class="es-ws-kv-label">Founded</span><span class="es-ws-kv-value">${escapeHtml(trimOrNull(detected?.founded) ?? "—")}</span></div>
      <div class="es-ws-kv-row"><span class="es-ws-kv-label">Company type</span><span class="es-ws-kv-value">${escapeHtml(trimOrNull(detected?.company_type) ?? "—")}</span></div>
      <div class="es-ws-kv-row"><span class="es-ws-kv-label">Ownership</span><span class="es-ws-kv-value">${escapeHtml(trimOrNull(detected?.ownership_type) ?? "—")}</span></div>
      <div class="es-ws-kv-row"><span class="es-ws-kv-label">Relationship</span><span class="es-ws-kv-value">${escapeHtml(relationship)}</span></div>
    `)

    setText("es-ws-company-contacts-count", String(contactsCount))
    setText("es-ws-company-opportunities-count", String(oppCount))
    setText("es-ws-company-customers-count", String(customerCount))

    const nba = resolveNextBestAction(context, crmPayload, hasMatch)
    setText("es-ws-nba-label", nba.label)
    setText("es-ws-nba-reason", nba.reason ?? "")
    const nbaBtn = document.getElementById("es-ws-nba-cta")
    if (nbaBtn) {
      nbaBtn.textContent = nba.cta
      nbaBtn.dataset.action = nba.action
    }

    renderResearchSnapshot(context, detected)
    renderTimeline(context)
    renderQueueShortcuts(recentCaptures)
    renderEmployees(context)
    renderTechnologies(detected, context)
    renderSignals(detected, context)
    renderCrmRelationship(context, relationship, contactsCount, oppCount, customerCount)

    const addBtn = document.getElementById("es-ws-add-btn")
    const openLeadBtn = document.getElementById("es-ws-open-lead-btn")
    const updateBtn = document.getElementById("es-ws-update-lead-btn")
    const reviewedBtn = document.getElementById("es-ws-mark-reviewed-btn")

    if (addBtn) addBtn.hidden = hasMatch
    if (openLeadBtn) openLeadBtn.hidden = !hasMatch
    if (updateBtn) updateBtn.hidden = !hasMatch
    if (reviewedBtn) {
      reviewedBtn.hidden = !hasMatch || context?.status_badge !== "needs_review"
    }

    const sidepanelName = document.getElementById("sidepanel-profile-name")
    if (sidepanelName) sidepanelName.textContent = name

    if (context && crmContextUi?.crmContextRows) {
      const legacyGrid = document.getElementById("linkedin-crm-context")
      if (legacyGrid) {
        legacyGrid.innerHTML = crmContextUi
          .crmContextRows(context)
          .map(
            (row) =>
              `<div class="linkedin-crm-context-row"><span class="linkedin-crm-context-label">${escapeHtml(row.label)}</span><span class="linkedin-crm-context-value">${escapeHtml(row.value)}</span></div>`,
          )
          .join("")
      }
    }
  }

  function similarityReasons(match) {
    const text = match.why_matched ?? ""
    const reasons = text
      .split(/[.;]\s*/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 3)
    if (reasons.length) return reasons
    if (match.relationship_type) return [match.relationship_type.replace(/_/g, " ")]
    return ["Evidence-backed Growth Engine similarity"]
  }

  function crmBadgeForSimilar(match) {
    if (match.relationship_type?.includes("customer")) return "Existing Customer"
    if (match.relationship_type?.includes("opportunity")) return "Existing Opportunity"
    if (match.lead_id) return "Existing Prospect"
    return "Not In CRM"
  }

  function applySimilarFilters(matches) {
    const active = [...document.querySelectorAll("[data-similar-filter]:checked")].map(
      (input) => input.dataset.similarFilter,
    )
    if (!active.length) return matches
    const seed = buildCompanySeed()
    return matches.filter((match) => {
      const why = `${match.why_matched ?? ""} ${match.relationship_type ?? ""}`.toLowerCase()
      return active.every((filter) => {
        if (filter === "industry") return /industry|sic|naics|category/.test(why)
        if (filter === "region") {
          const location = (match.location ?? "").toLowerCase()
          return Boolean(seed.city && location.includes(seed.city.toLowerCase())) ||
            Boolean(seed.state && location.includes(seed.state.toLowerCase())) ||
            /region|geograph|market/.test(why)
        }
        if (filter === "size") return /employee|size|headcount/.test(why)
        if (filter === "signals") return /signal|intent|hiring|growth|funding|news/.test(why)
        return true
      })
    })
  }

  function renderSimilarCompanies(matches = similarState.matches) {
    const list = document.getElementById("es-ws-similar-list")
    const insight = document.getElementById("es-ws-similar-insight")
    if (!list) return
    const visibleMatches = applySimilarFilters(matches)
    if (!matches.length) {
      list.innerHTML = '<p class="es-ws-empty">No similar companies yet. Run research or expand the search radius.</p>'
      if (insight) insight.textContent = "No evidence-backed similar companies are loaded yet."
      return
    }
    if (!visibleMatches.length) {
      list.innerHTML = '<p class="es-ws-empty">No similar companies match the selected filters. Expand the search radius or clear filters.</p>'
      if (insight) insight.textContent = "No evidence-backed matches for the active filters."
      return
    }
    const seed = buildCompanySeed()
    if (insight) {
      insight.textContent = seed.company_name
        ? `Companies similar to ${seed.company_name} based on Growth Engine evidence.`
        : "Evidence-backed similar companies."
    }
    list.innerHTML = visibleMatches
      .map((match, index) => {
        const reasons = similarityReasons(match)
        return `
          <article class="es-ws-similar-card">
            <label class="es-ws-similar-select"><input type="checkbox" data-similar-index="${index}" /> Select</label>
            <div class="es-ws-similar-score">${Math.round(match.confidence ?? 0)}% Similar</div>
            <div class="es-ws-similar-name">${escapeHtml(match.company_name)}</div>
            <div class="es-ws-similar-meta">${escapeHtml(match.relationship_type?.replace(/_/g, " ") ?? "Similar company")} · ${escapeHtml(match.location ?? "Location unknown")}</div>
            <div class="es-ws-similar-meta">${match.website ? `<a href="${escapeHtml(match.website)}" target="_blank" rel="noopener noreferrer">${escapeHtml(match.website)}</a>` : "Website unknown"}</div>
            <div class="es-ws-similar-badge">${escapeHtml(crmBadgeForSimilar(match))}</div>
            <ul class="es-ws-similar-reasons">${reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}</ul>
            <div class="button-row">
              <button type="button" class="es-ws-inline-btn" data-similar-action="open" data-lead-id="${escapeHtml(match.lead_id ?? "")}" data-website="${escapeHtml(match.website ?? "")}">Open Company</button>
              <button type="button" class="es-ws-inline-btn" data-similar-action="queue" data-company="${escapeHtml(match.company_name)}">Add to Queue</button>
            </div>
          </article>
        `
      })
      .join("")

    list.querySelectorAll("[data-similar-action='open']").forEach((button) => {
      button.addEventListener("click", () => {
        const website = button.dataset.website
        if (website) window.open(website, "_blank", "noopener,noreferrer")
      })
    })
    list.querySelectorAll("[data-similar-action='queue']").forEach((button) => {
      button.addEventListener("click", () => {
        window.__equipifyCopilotHooks?.switchTab?.("queue")
        document.getElementById("copilot-add-to-queue-btn")?.click()
      })
    })
  }

  async function discoverSimilarCompanies() {
    const seed = buildCompanySeed()
    const statusEl = document.getElementById("es-ws-similar-insight")
    const list = document.getElementById("es-ws-similar-list")
    if (!seed.lead_id && !seed.company_name) {
      if (statusEl) statusEl.textContent = "No company context available. Open a LinkedIn company or profile first."
      return
    }
    similarState.loading = true
    if (statusEl) statusEl.textContent = "Discovering similar companies from Growth Engine evidence..."
    if (list) list.innerHTML = ""
    try {
      const response = await fetch(`${apiBaseUrl()}${config.SIMILAR_COMPANIES_PATH}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...seed, limit: 10 }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok || !body?.ok) throw new Error(body?.message ?? "Similar company discovery failed.")
      similarState.matches = body.matches ?? []
      renderSimilarCompanies(similarState.matches)
    } catch (error) {
      if (statusEl) statusEl.textContent = error instanceof Error ? error.message : "Could not discover similar companies."
      renderSimilarCompanies([])
    } finally {
      similarState.loading = false
    }
  }

  function wireActions(deps) {
    function switchCompanyTab(tabId) {
      document.querySelectorAll("[data-company-tab]").forEach((button) => {
        button.classList.toggle("active", button.dataset.companyTab === tabId)
      })
      document.querySelectorAll("[data-company-panel]").forEach((panel) => {
        panel.hidden = panel.dataset.companyPanel !== tabId
      })
      if (tabId === "similar" && !similarState.matches.length && !similarState.loading) {
        discoverSimilarCompanies()
      }
    }

    async function runContactEnrichment(kind) {
      const input = lastRenderInput ?? {}
      const form = input.formValues ?? {}
      const detected = input.detected ?? {}
      const statusEl = document.getElementById("es-ws-enrichment-status")
      const resultsEl = document.getElementById("es-ws-enrichment-results")
      const copyBtn = document.getElementById("es-ws-enrichment-copy-btn")
      const saveBtn = document.getElementById("es-ws-enrichment-save-btn")
      if (statusEl) statusEl.textContent = `Finding ${kind} through approved providers...`
      if (resultsEl) {
        resultsEl.hidden = true
        resultsEl.innerHTML = ""
      }

      try {
        const response = await fetch(`${apiBaseUrl()}${config.CONTACT_ENRICHMENT_PATH}`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contact_name: form.contact_name,
            title: form.title,
            company_name: form.company_name ?? detected.company_name,
            location: form.location,
            linkedin_url: form.linkedin_url ?? detected.linkedin_url,
            website: form.website ?? detected.website,
          }),
        })
        const body = await response.json().catch(() => null)
        if (!response.ok || !body?.ok) {
          throw new Error(body?.message ?? "Contact enrichment failed.")
        }
        if (!body.configured) {
          setEnrichmentStatus(ENRICHMENT_SETUP_MESSAGE, "error")
          if (copyBtn) copyBtn.hidden = true
          if (saveBtn) saveBtn.hidden = true
          return
        }
        if (!body.result) {
          setEnrichmentStatus(body.message ?? "No contact details found from approved providers.")
          if (copyBtn) copyBtn.hidden = true
          if (saveBtn) saveBtn.hidden = true
          return
        }
        lastEnrichmentResult = body.result
        if (statusEl) statusEl.textContent = `${body.result.provider_source} · ${body.result.confidence}% confidence`
        if (resultsEl) {
          const email = body.result.work_email ?? "—"
          const phone = body.result.phone ?? "—"
          resultsEl.hidden = false
          resultsEl.innerHTML = `
            <div class="es-ws-kv-row"><span class="es-ws-kv-label">Work email</span><span class="es-ws-kv-value">${escapeHtml(email)}</span></div>
            <div class="es-ws-kv-row"><span class="es-ws-kv-label">Phone</span><span class="es-ws-kv-value">${escapeHtml(phone)}</span></div>
            <div class="es-ws-kv-row"><span class="es-ws-kv-label">Source</span><span class="es-ws-kv-value">${escapeHtml(body.result.provider_source ?? "approved_provider")}</span></div>
            <div class="es-ws-kv-row"><span class="es-ws-kv-label">Verification</span><span class="es-ws-kv-value">${escapeHtml(body.result.verification_status ?? "unknown")}</span></div>
          `
        }
        if (body.result.work_email) {
          const emailInput = document.getElementById("email")
          if (emailInput && !emailInput.value) emailInput.value = body.result.work_email
        }
        if (body.result.phone) {
          const phoneInput = document.getElementById("phone")
          if (phoneInput && !phoneInput.value) phoneInput.value = body.result.phone
        }
        if (copyBtn) copyBtn.hidden = false
        if (saveBtn) saveBtn.hidden = false
      } catch (error) {
        setEnrichmentStatus(
          error instanceof Error ? error.message : "Could not find contact details.",
          "error",
        )
      }
    }

    setEnrichmentStatus(ENRICHMENT_SETUP_MESSAGE)

    document.getElementById("workspace-refresh-btn")?.addEventListener("click", () => {
      deps?.refresh?.()
    })

    document.querySelectorAll("[data-company-tab]").forEach((button) => {
      button.addEventListener("click", () => switchCompanyTab(button.dataset.companyTab))
    })

    ;[
      "es-ws-employee-search",
      "es-ws-employee-department-filter",
      "es-ws-employee-seniority-filter",
      "es-ws-employee-crm-filter",
    ].forEach((id) => {
      document.getElementById(id)?.addEventListener("input", renderFilteredEmployees)
      document.getElementById(id)?.addEventListener("change", renderFilteredEmployees)
    })

    document.getElementById("es-ws-add-btn")?.addEventListener("click", () => {
      document.getElementById("linkedin-add-btn")?.click()
    })

    document.getElementById("es-ws-open-lead-btn")?.addEventListener("click", () => {
      document.getElementById("linkedin-open-lead-btn")?.click()
    })

    document.getElementById("es-ws-update-lead-btn")?.addEventListener("click", () => {
      document.getElementById("linkedin-update-lead-btn")?.click()
    })

    document.getElementById("es-ws-mark-reviewed-btn")?.addEventListener("click", () => {
      document.getElementById("linkedin-mark-reviewed-btn")?.click()
    })

    document.getElementById("es-ws-verify-email-btn")?.addEventListener("click", () => {
      const verifyCheckbox = document.getElementById("verify-email")
      if (verifyCheckbox) verifyCheckbox.checked = true
      document.getElementById("submit-btn")?.click()
    })

    document.getElementById("es-ws-find-email-btn")?.addEventListener("click", () => {
      runContactEnrichment("email")
    })

    document.getElementById("es-ws-find-phone-btn")?.addEventListener("click", () => {
      runContactEnrichment("phone")
    })

    document.getElementById("es-ws-enrichment-copy-btn")?.addEventListener("click", () => {
      const value = lastEnrichmentResult?.work_email || lastEnrichmentResult?.phone
      copyText(value)
    })

    document.getElementById("es-ws-enrichment-save-btn")?.addEventListener("click", () => {
      document.getElementById("submit-btn")?.click()
    })

    document.getElementById("es-ws-nba-cta")?.addEventListener("click", (event) => {
      const action = event.currentTarget?.dataset?.action
      if (action === "add_contact") document.getElementById("es-ws-add-btn")?.click()
      else if (action === "mark_reviewed") document.getElementById("es-ws-mark-reviewed-btn")?.click()
      else if (action === "open_opportunity") document.getElementById("linkedin-open-opportunity-btn")?.click()
      else document.getElementById("es-ws-open-lead-btn")?.click()
    })

    document.getElementById("es-ws-queue-needs-review")?.addEventListener("click", () => {
      window.__equipifyCopilotHooks?.switchTab?.("queue")
    })

    document.getElementById("es-ws-queue-verification")?.addEventListener("click", () => {
      window.__equipifyCopilotHooks?.switchTab?.("queue")
      document.getElementById("copilot-process-queue-btn")?.click()
    })

    document.getElementById("es-ws-queue-discovery")?.addEventListener("click", () => {
      window.__equipifyCopilotHooks?.switchTab?.("queue")
    })

    document.getElementById("es-ws-run-discovery-btn")?.addEventListener("click", () => {
      const discoveryCheckbox = document.getElementById("queue-discovery")
      if (discoveryCheckbox) discoveryCheckbox.checked = true
      window.__equipifyCopilotHooks?.switchTab?.("queue")
      document.getElementById("copilot-add-to-queue-btn")?.click()
    })

    document.getElementById("es-ws-run-research-btn")?.addEventListener("click", () => {
      document.getElementById("copilot-generate-research-btn-inline")?.click()
    })

    document.getElementById("es-ws-discover-similar-btn")?.addEventListener("click", () => {
      discoverSimilarCompanies()
    })

    document.querySelectorAll("[data-similar-filter]").forEach((input) => {
      input.addEventListener("change", () => renderSimilarCompanies())
    })

    document.getElementById("es-ws-similar-bulk-queue-btn")?.addEventListener("click", () => {
      window.__equipifyCopilotHooks?.switchTab?.("queue")
      document.getElementById("copilot-add-to-queue-btn")?.click()
    })

    document.getElementById("es-ws-queue-recent")?.addEventListener("click", () => {
      document.getElementById("recent-captures-panel")?.scrollIntoView({ behavior: "smooth" })
    })
  }

  window.EquipifySalesWorkspace = {
    render,
    wireActions,
  }
})()
