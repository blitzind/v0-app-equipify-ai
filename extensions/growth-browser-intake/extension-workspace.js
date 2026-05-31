/**
 * Equipify Sales workspace renderer — Prospeo-style prospecting side panel.
 */
;(function initEquipifySalesWorkspace() {
  const linkedinStatus = window.EquipifyGrowthLinkedInStatus
  const crmContextUi = window.EquipifyGrowthCrmContext
  const config = window.EquipifyGrowthExtensionConfig
  const INTELLIGENCE_LOG_PREFIX = "[Equipify Sales:intelligence]"
  const PUBLIC_NOT_FOUND = "Not found on public profile"
  const COMPANY_NOT_FOUND = "Not found on public company page"
  const COMPANY_NOT_DETECTED = "Company not detected"
  const COMPANY_INTEL_UNAVAILABLE = "Unable to identify current company from LinkedIn profile."
  const FOLLOWERS_NOT_AVAILABLE = "Not available"
  const PROFILE_CONTEXT_FAILED = "Profile context failed to load"
  let lastRenderInput = null
  let lastEnrichmentResult = null
  let lastCompanyEnrichment = null
  let lastEmployeeRows = []
  let lastCrmContactRows = []
  let similarState = { seedKey: null, loading: false, matches: [] }

  function trimOrNull(value) {
    const trimmed = (value ?? "").trim()
    return trimmed ? trimmed : null
  }

  function intelLog(scope, details = {}) {
    console.log(INTELLIGENCE_LOG_PREFIX, scope, details)
  }

  function publicValue(value) {
    return trimOrNull(value) ?? PUBLIC_NOT_FOUND
  }

  function companyValue(value) {
    return trimOrNull(value) ?? COMPANY_NOT_FOUND
  }

  function normalizeComparisonName(value) {
    return trimOrNull(value)?.toLowerCase().replace(/\s+/g, " ") ?? ""
  }

  function rejectCompanyIfPersonName(companyName, personName) {
    if (typeof window.__equipifyGrowthRejectCompanyIfPersonName === "function") {
      return window.__equipifyGrowthRejectCompanyIfPersonName(companyName, personName)
    }
    const raw = trimOrNull(companyName)
    if (!raw) return null
    if (personName && normalizeComparisonName(raw) === normalizeComparisonName(personName)) return null
    return raw
  }

  function resolvePersonName(detected, context, formValues) {
    return (
      trimOrNull(detected?.contact_name) ||
      trimOrNull(context?.contact_name) ||
      trimOrNull(formValues?.contact_name)
    )
  }

  function pickCompanyCandidate(candidates, personName) {
    for (const candidate of candidates) {
      const sanitized = rejectCompanyIfPersonName(candidate, personName)
      if (sanitized) return sanitized
    }
    return null
  }

  function hasResolvedCompanyName(companyName) {
    const raw = trimOrNull(companyName)
    if (!raw) return false
    if (raw === COMPANY_NOT_DETECTED) return false
    if (raw === COMPANY_INTEL_UNAVAILABLE) return false
    return true
  }

  function setCompanyIntelAvailability(hasCompany) {
    const section = document.querySelector(".es-ws-company-intel")
    if (!section) return

    section.querySelectorAll(".es-ws-company-tab, .es-ws-company-panel, .es-ws-company-stats").forEach((el) => {
      el.hidden = !hasCompany
    })

    const actions = section.querySelector(".es-ws-card-title-actions")
    if (actions) actions.hidden = !hasCompany

    const statusEl = document.getElementById("es-ws-company-enrichment-status")
    if (statusEl) {
      statusEl.textContent = hasCompany ? "" : COMPANY_INTEL_UNAVAILABLE
    }

    const subtitle = document.getElementById("es-ws-company-subtitle")
    if (subtitle && !hasCompany) {
      subtitle.textContent = COMPANY_INTEL_UNAVAILABLE
    }

    const logo = document.getElementById("es-ws-company-logo")
    if (logo && !hasCompany) logo.textContent = "?"
  }

  function followersValue(value) {
    const raw = trimOrNull(value)
    if (!raw) return FOLLOWERS_NOT_AVAILABLE
    if (raw.length > 80 || /skip to|main content|keyboard shortcut/i.test(raw)) return FOLLOWERS_NOT_AVAILABLE
    if (!/\d[\d,]*\+?\s+followers/i.test(raw)) return FOLLOWERS_NOT_AVAILABLE
    return raw
  }

  function parseHeadlineParts(headline) {
    if (!headline) return { title: null, company: null }
    if (typeof window.__equipifyGrowthParseLinkedInHeadline === "function") {
      return window.__equipifyGrowthParseLinkedInHeadline(headline)
    }
    const atMatch = headline.match(/^(.+?)\s+at\s+(.+?)(?:\s*[|·].*)?$/i)
    if (atMatch) return { title: trimOrNull(atMatch[1]), company: trimOrNull(atMatch[2]) }
    return { title: trimOrNull(headline), company: null }
  }

  function resolveProfileTitle(detected, formValues) {
    return (
      trimOrNull(formValues?.title) ||
      trimOrNull(detected?.job_title) ||
      trimOrNull(detected?.title) ||
      parseHeadlineParts(detected?.raw_headline ?? detected?.headline).title ||
      PUBLIC_NOT_FOUND
    )
  }

  function resolveProfileCompany(detected, context, formValues) {
    const personName = resolvePersonName(detected, context, formValues)
    const resolved = pickCompanyCandidate(
      [
        trimOrNull(context?.company_name),
        trimOrNull(formValues?.company_name),
        trimOrNull(detected?.company_name),
        parseHeadlineParts(detected?.headline).company,
      ],
      personName,
    )
    if (resolved) return resolved
    return detected?.linkedin_page_kind === "profile" ? COMPANY_NOT_DETECTED : PUBLIC_NOT_FOUND
  }

  function inferProfileNameFromPageTitle(pageTitle) {
    const raw = trimOrNull(pageTitle)
    if (!raw) return null
    const withoutLinkedIn = raw.replace(/\s*[|\-–—]\s*LinkedIn\s*$/i, "").trim()
    const firstSegment = withoutLinkedIn.split(/\s*[|\-–—]\s*/)[0]?.trim()
    if (!firstSegment) return null
    return trimOrNull(firstSegment.split(/\s+-\s+/)[0]?.trim() ?? firstSegment)
  }

  function resolveProfileDisplayName(detected, context, formValues) {
    const direct =
      trimOrNull(context?.contact_name) ||
      trimOrNull(formValues?.contact_name) ||
      trimOrNull(detected?.contact_name)
    if (direct) return direct
    if (detected?.linkedin_page_kind === "company") return trimOrNull(detected?.company_name) ?? PROFILE_CONTEXT_FAILED
    if (detected?.linkedin_page_kind === "profile") {
      return inferProfileNameFromPageTitle(detected?.page_title) ?? PROFILE_CONTEXT_FAILED
    }
    return trimOrNull(detected?.page_title?.split("|")[0]) ?? PROFILE_CONTEXT_FAILED
  }

  function resolveCompanyIntelDisplayName(detected, context, formValues, enrichment) {
    const resolved = resolveCompanyIntelName(detected, context, formValues, enrichment)
    if (resolved !== COMPANY_NOT_DETECTED) return resolved
    return COMPANY_NOT_DETECTED
  }

  function resolveCompanyIntelName(detected, context, formValues, enrichment) {
    const personName = resolvePersonName(detected, context, formValues)
    const resolved = pickCompanyCandidate(
      [
        trimOrNull(enrichment?.company_name),
        trimOrNull(context?.company_name),
        trimOrNull(formValues?.company_name),
        trimOrNull(detected?.company_name),
        parseHeadlineParts(detected?.headline).company,
      ],
      personName,
    )
    return resolved ?? COMPANY_NOT_DETECTED
  }

  function mergeCompanyIntel(detected, enrichment) {
    const enriched = enrichment ?? {}
    return {
      company_name: enriched.company_name ?? detected?.company_name ?? null,
      company_description: enriched.company_description ?? detected?.company_description ?? null,
      website: enriched.website ?? detected?.website ?? null,
      linkedin_company_url: enriched.linkedin_company_url ?? detected?.linkedin_company_url ?? null,
      industry: enriched.industry ?? detected?.industry ?? null,
      employee_count: enriched.employee_count ?? detected?.employee_count ?? null,
      employee_range: enriched.employee_range ?? detected?.employee_range ?? null,
      location: enriched.location ?? detected?.location ?? null,
      followers_count: enriched.followers_count ?? detected?.followers_count ?? null,
      company_type: enriched.company_type ?? detected?.company_type ?? null,
      founded: enriched.founded ?? detected?.founded ?? null,
      keywords: enriched.keywords ?? detected?.keywords ?? [],
      office_locations: enriched.office_locations ?? detected?.office_locations ?? [],
      company_logo_url: enriched.company_logo_url ?? detected?.company_logo_url ?? null,
    }
  }

  function setCompanyEnrichmentStatus(message) {
    const el = document.getElementById("es-ws-company-enrichment-status")
    if (el) el.textContent = message
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
    "Connect an enrichment provider such as People Data Labs, Prospeo, Apollo, Hunter, or website discovery to find email/phone."

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

  function renderKvList(containerId, rows) {
    const populated = rows.filter((row) => (row.value && row.value !== "—") || row.html)
    if (!populated.length) {
      setHtml(containerId, '<p class="es-ws-empty">No visible details on this page yet. Capture or run Research to enrich.</p>')
      return
    }
    setHtml(
      containerId,
      populated
        .map(
          (row) =>
            `<div class="es-ws-kv-row"><span class="es-ws-kv-label">${escapeHtml(row.label)}</span><span class="es-ws-kv-value">${row.html ?? escapeHtml(row.value)}</span></div>`,
        )
        .join(""),
    )
  }

  function chipToneForLevel(level) {
    const normalized = String(level ?? "").toLowerCase()
    if (normalized === "executive") return "executive"
    if (normalized === "high" || normalized === "strong") return "high"
    if (normalized === "medium" || normalized === "moderate") return "medium"
    return "low"
  }

  function renderContactIntelligence(input) {
    const panel = document.getElementById("es-ws-contact-intelligence-panel")
    const chipsEl = document.getElementById("es-ws-contact-intelligence-chips")
    const anglesEl = document.getElementById("es-ws-ci-angles")
    const nbaEl = document.getElementById("es-ws-ci-nba")
    const nbaReasonEl = document.getElementById("es-ws-ci-nba-reason")
    if (!panel || !chipsEl || !anglesEl || !nbaEl || !nbaReasonEl) return

    const detected = input?.detected ?? null
    const formValues = input?.formValues ?? {}
    const context = input?.crmPayload?.context ?? null
    const hasMatch = Boolean(context?.lead_id)
    const contextNormalize = window.EquipifyGrowthContextNormalize
    const normalized =
      contextNormalize?.normalizeExtractionPayload?.({
        detected,
        formValues,
        context,
      }) ?? {}

    const pageKind = detected?.linkedin_page_kind ?? null
    const title =
      normalized.title && normalized.title !== PUBLIC_NOT_FOUND
        ? normalized.title
        : trimOrNull(formValues?.title) || trimOrNull(detected?.job_title) || trimOrNull(detected?.title)
    const person = normalized.person ?? null

    if (pageKind === "company" || (!person && !title)) {
      panel.hidden = true
      return
    }

    const analyzer = window.EquipifyGrowthContactIntelligence
    if (!analyzer?.analyzeContactIntelligence) {
      panel.hidden = true
      return
    }

    const intelligence = analyzer.analyzeContactIntelligence({
      person,
      title,
      company: normalized.company,
      location: normalized.location,
      connection_degree: detected?.connection_degree ?? null,
      mutual_connections_count: detected?.mutual_connections_count ?? null,
      connections_count: detected?.connections_count ?? null,
      hasCrmMatch: hasMatch,
    })

    panel.hidden = false

    const chips = [
      { label: "Decision Maker", value: intelligence.decision_maker_level, tone: chipToneForLevel(intelligence.decision_maker_level) },
      { label: "Department", value: intelligence.department, tone: "neutral" },
      { label: "Seniority", value: intelligence.seniority, tone: "neutral" },
      { label: "Buying Influence", value: intelligence.buying_influence, tone: chipToneForLevel(intelligence.buying_influence) },
      { label: "Relationship", value: intelligence.relationship_strength, tone: chipToneForLevel(intelligence.relationship_strength) },
      {
        label: "Research Confidence",
        value: `${intelligence.research_confidence}%`,
        tone: intelligence.research_confidence >= 75 ? "high" : intelligence.research_confidence >= 50 ? "medium" : "low",
      },
    ]

    chipsEl.innerHTML = chips
      .map(
        (chip) =>
          `<span class="es-ws-ci-chip" data-tone="${escapeHtml(chip.tone)}"><span class="es-ws-ci-chip-label">${escapeHtml(chip.label)}</span><span class="es-ws-ci-chip-value">${escapeHtml(chip.value)}</span></span>`,
      )
      .join("")

    const primaryAngle = intelligence.recommended_angles[0] ?? "Operational Efficiency"
    const extraAngles = intelligence.recommended_angles.slice(1)
    anglesEl.innerHTML = `
      <strong class="es-ws-ci-angle-primary">${escapeHtml(primaryAngle)}</strong>
      ${extraAngles.length ? `<span class="es-ws-ci-angle-secondary">${extraAngles.map((angle) => escapeHtml(angle)).join(" · ")}</span>` : ""}`

    nbaEl.textContent = intelligence.next_best_action
    nbaReasonEl.textContent = intelligence.next_best_action_reason

    intelLog("contact_intelligence_rendered", {
      decision_maker_level: intelligence.decision_maker_level,
      department: intelligence.department,
      seniority: intelligence.seniority,
    })
  }

  function renderProfilePhoto(name, photoUrl) {
    const wrap = document.getElementById("es-ws-profile-photo-wrap")
    if (!wrap) return
    wrap.replaceChildren()

    const resolvedUrl = trimOrNull(photoUrl)
    if (resolvedUrl) {
      const img = document.createElement("img")
      img.className = "es-ws-profile-photo"
      img.src = resolvedUrl
      img.alt = name ? `${name} profile photo` : "Profile photo"
      img.referrerPolicy = "no-referrer"
      img.addEventListener("error", () => {
        wrap.replaceChildren()
        const placeholder = document.createElement("div")
        placeholder.className = "es-ws-profile-photo es-ws-profile-photo--placeholder"
        placeholder.textContent = initials(name)
        wrap.appendChild(placeholder)
      })
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
      container.innerHTML = context?.lead_id
        ? '<p class="es-ws-empty">No recent CRM or Growth activity loaded for this record.</p>'
        : '<p class="es-ws-empty">No recent activity yet. Capture this page to start tracking activity in Equipify.</p>'
      intelLog("activity", { count: 0, hasMatch: Boolean(context?.lead_id) })
      return
    }

    intelLog("activity", { count: events.length })

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

  function renderResearchSnapshot(context, detected, formValues) {
    const summaryEl = document.getElementById("es-ws-research-summary")
    const signalsEl = document.getElementById("es-ws-research-signals")
    if (!summaryEl || !signalsEl) return

    const contextNormalize = window.EquipifyGrowthContextNormalize
    const normalized =
      contextNormalize?.normalizeExtractionPayload?.({
        detected,
        formValues,
        context,
      }) ?? {
        person: null,
        title: null,
        company: null,
        location: null,
        hasContext: false,
      }

    const lines = contextNormalize?.buildResearchSnapshotLines?.(normalized) ?? []
    const hasAnyLine = lines.some((line) => trimOrNull(line.value))

    if (hasAnyLine) {
      summaryEl.innerHTML = `
        <dl class="es-ws-research-grid">
          ${lines
            .map(
              (line) => `
            <div class="es-ws-research-row">
              <dt>${escapeHtml(line.label)}</dt>
              <dd>${escapeHtml(trimOrNull(line.value) ?? "—")}</dd>
            </div>`,
            )
            .join("")}
        </dl>`
    } else {
      summaryEl.textContent = "Capture this page to build a research snapshot in Equipify."
    }

    const signals = []
    if (detected?.source_platform === "linkedin") signals.push("LinkedIn")
    if (context?.lead_status_label) signals.push(context.lead_status_label)
    if (context?.next_action?.label) signals.push(context.next_action.label)
    if (context?.lead_score != null) signals.push(`Score ${context.lead_score}`)
    if (context?.company_contacts_count) signals.push(`${context.company_contacts_count} CRM contacts`)
    if (context?.related_leads_count) signals.push(`${context.related_leads_count} related leads`)
    if (context?.opportunity?.stage_label) signals.push(context.opportunity.stage_label)

    signalsEl.innerHTML = signals.length
      ? signals.map((signal) => `<span class="es-ws-signal">${escapeHtml(signal)}</span>`).join("")
      : normalized.hasContext
        ? '<span class="es-ws-signal">Ready to capture</span>'
        : '<span class="es-ws-signal">Awaiting page context</span>'

    intelLog("research_snapshot", {
      hasContext: normalized.hasContext,
      person: normalized.person,
      company: normalized.company,
    })
  }

  function buildCurrentProfileEmployeeCandidate(detected, context, formValues) {
    if (detected?.linkedin_page_kind !== "profile") return null
    const name = resolveProfileDisplayName(detected, context, formValues)
    if (!name || name === PROFILE_CONTEXT_FAILED) return null
    const title = resolveProfileTitle(detected, formValues)
    const linkedinUrl = trimOrNull(formValues?.linkedin_url) || trimOrNull(detected?.linkedin_url)
    return {
      name,
      title: title !== PUBLIC_NOT_FOUND ? title : null,
      linkedin_url: linkedinUrl,
      profile_url: linkedinUrl,
      source_url: linkedinUrl,
      profile_photo_url: detected?.profile_photo_url ?? null,
      department: inferDepartment(title !== PUBLIC_NOT_FOUND ? title : null),
      seniority: inferSeniority(title !== PUBLIC_NOT_FOUND ? title : null),
      crm_status: context?.lead_id ? "In CRM" : "Not In CRM",
      lead_id: context?.lead_id ?? null,
      source: "current_profile",
    }
  }

  function resolveEmployeeEmptyMessage(detected, rows) {
    const pageKind = detected?.linkedin_page_kind ?? null
    const hasCrm = rows.some((row) => row.source === "crm")
    const hasVisible = rows.some((row) => row.source === "linkedin_visible" || row.source === "linkedin_visible_page")
    const hasProfile = rows.some((row) => row.source === "current_profile")

    if (pageKind === "profile") {
      if (hasProfile || hasVisible) {
        return null
      }
      return "LinkedIn profile pages show the current person above. Open the company page or run Discovery Actions to find teammates and CRM contacts."
    }
    if (pageKind === "company") {
      if (hasVisible || hasCrm) return null
      return "No employees are visible in the current company page section. Scroll to People or run Discovery Actions to queue contact discovery."
    }
    if (hasCrm || hasVisible) return null
    return "Employee discovery works best on LinkedIn company pages. Use Discovery Actions to queue contact discovery for this account."
  }

  function renderQueueShortcuts(recentCaptures) {
    const recentEl = document.getElementById("es-ws-queue-recent-count")
    if (recentEl) recentEl.textContent = String(recentCaptures?.length ?? 0)
  }

  function renderEmployees(context, visiblePeople = [], detected = null, formValues = {}) {
    const list = document.getElementById("es-ws-employees-list")
    if (!list) return
    const employeeRow = window.EquipifyGrowthEmployeeRow

    const visibleRows = (visiblePeople ?? []).map((person) => ({
      name: person.full_name ?? person.name,
      title: person.job_title ?? person.title,
      linkedin_url: trimOrNull(person.linkedin_url),
      profile_url: trimOrNull(person.profile_url),
      source_url: trimOrNull(person.source_url) ?? trimOrNull(person.linkedin_url),
      profile_photo_url: person.profile_photo_url ?? null,
      department: inferDepartment(person.job_title ?? person.title),
      seniority: inferSeniority(person.job_title ?? person.title),
      crm_status: "Visible on page",
      lead_id: null,
      source: trimOrNull(person.source) ?? "linkedin_visible",
    }))

    const profileCandidate = buildCurrentProfileEmployeeCandidate(detected, context, formValues)
    const merged = []
    if (profileCandidate) merged.push(profileCandidate)
    for (const row of visibleRows) {
      const key = `${(row.name ?? "").toLowerCase()}|${(row.linkedin_url ?? "").toLowerCase()}`
      if (
        merged.some(
          (existing) =>
            `${(existing.name ?? "").toLowerCase()}|${(existing.linkedin_url ?? "").toLowerCase()}` === key,
        )
      ) {
        continue
      }
      merged.push(row)
    }

    lastEmployeeRows = merged
    intelLog("employees", {
      profileCandidate: Boolean(profileCandidate),
      visibleCount: visibleRows.length,
      total: merged.length,
      pageKind: detected?.linkedin_page_kind ?? null,
    })

    populateEmployeeFilters(lastEmployeeRows)
    renderFilteredEmployees(detected)
  }

  function buildCrmContactRows(context) {
    const relationshipMap = context?.company_relationship_map ?? {}
    return [...(relationshipMap.contacts ?? []), ...(relationshipMap.related_leads ?? [])].map((contact) => ({
      ...contact,
      name: contact.name ?? contact.contact_name ?? "CRM contact",
      title: contact.title ?? contact.job_title ?? "Title unknown",
      linkedin_url: trimOrNull(contact.linkedin_url),
      profile_url: trimOrNull(contact.profile_url),
      source_url: trimOrNull(contact.source_url),
      meta: contact.status ? contact.status.replace(/_/g, " ") : "In CRM",
      crm_status: contact.status ? contact.status.replace(/_/g, " ") : "In CRM",
      department: contact.department ?? inferDepartment(contact.title),
      seniority: contact.seniority ?? inferSeniority(contact.title),
      source: "crm",
    }))
  }

  function renderCrmContacts(context) {
    const list = document.getElementById("es-ws-crm-contacts-list")
    if (!list) return
    const objectRow = window.EquipifyGrowthEmployeeRow
    lastCrmContactRows = buildCrmContactRows(context)

    if (!lastCrmContactRows.length) {
      list.innerHTML =
        '<p class="es-ws-empty">No CRM contacts linked to this company yet. Capture the profile or run Discovery Actions to populate contacts.</p>'
      return
    }

    list.innerHTML = lastCrmContactRows
      .slice(0, 8)
      .map((contact) => objectRow?.buildObjectRowHtml?.(contact, escapeHtml) ?? "")
      .join("")
    objectRow?.bindObjectRowActions?.(list)
    intelLog("crm_contacts", { count: lastCrmContactRows.length })
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

  function renderFilteredEmployees(detected = null) {
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
      const emptyMessage = resolveEmployeeEmptyMessage(detected ?? lastRenderInput?.detected ?? null, lastEmployeeRows)
      list.innerHTML = emptyMessage
        ? `<p class="es-ws-empty">${escapeHtml(emptyMessage)}</p>`
        : '<p class="es-ws-empty">No employees match the active filters.</p>'
      return
    }

    const employeeRow = window.EquipifyGrowthEmployeeRow
    list.innerHTML = contacts
      .slice(0, 6)
      .map((contact) => employeeRow?.buildObjectRowHtml?.(contact, escapeHtml) ?? "")
      .join("")

    employeeRow?.bindObjectRowActions?.(list)
  }

  function renderTechnologies(detected, context) {
    const list = document.getElementById("es-ws-technologies-list")
    if (!list) return
    const companyIntel = mergeCompanyIntel(detected ?? {}, lastCompanyEnrichment)
    const website = trimOrNull(companyIntel.website)
    const tech = [
      ...(Array.isArray(context?.technology_signals) ? context.technology_signals : []),
    ]
    const values = uniqueValues(tech)
    intelLog("technologies", { website, detectedCount: values.length })
    if (!website) {
      list.innerHTML =
        '<p class="es-ws-empty">No public company website detected. Tech stack detection requires a real website/domain from the company page.</p>'
      return
    }
    list.innerHTML = values.length
      ? values.map((value) => `<span class="es-ws-signal">${escapeHtml(value)}</span>`).join("")
      : `<p class="es-ws-empty">Website ${escapeHtml(website)} is visible, but no public tech stack signals are loaded. Run Research to enrich this account.</p>`
  }

  function renderSignals(detected, context) {
    const list = document.getElementById("es-ws-signals-list")
    if (!list) return
    const signals = [
      ...(Array.isArray(context?.research_signals) ? context.research_signals : []),
      context?.opportunity?.status_summary,
      context?.last_activity?.summary,
    ].filter(Boolean)
    intelLog("signals", { count: signals.length, hasCrmContext: Boolean(context?.lead_id) })
    list.innerHTML = signals.length
      ? signals.map((signal) => `<div class="es-ws-signal-row">${escapeHtml(signal)}</div>`).join("")
      : context?.lead_id
        ? '<p class="es-ws-empty">No Growth Engine company signals loaded for this CRM account yet.</p>'
        : '<p class="es-ws-empty">No CRM company signals yet. Capture this company to load Growth Engine signals.</p>'
  }

  function renderCrmRelationship(context, relationship, contactsCount, oppCount, customerCount, hasMatch) {
    if (!hasMatch) {
      setHtml(
        "es-ws-crm-relationship-list",
        '<p class="es-ws-empty">This profile or company is not matched in Equipify CRM yet. Capture to create or match a lead.</p>',
      )
      intelLog("crm", { matched: false })
      return
    }
    intelLog("crm", { matched: true, relationship, contactsCount, oppCount, customerCount })
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

    const name = resolveProfileDisplayName(detected, context, formValues)

    const title = resolveProfileTitle(detected, formValues)
    const company = resolveProfileCompany(detected, context, formValues)
    const companyIntel = mergeCompanyIntel(detected, lastCompanyEnrichment)
    const companyName = resolveCompanyIntelDisplayName(detected, context, formValues, lastCompanyEnrichment)
    const hasCompany = hasResolvedCompanyName(companyName)
    setCompanyIntelAvailability(hasCompany)
    const profileLocation =
      trimOrNull(formValues.location) || trimOrNull(detected?.location) || PUBLIC_NOT_FOUND
    const companyLocation = companyValue(companyIntel.location)
    const email = trimOrNull(formValues.email) || PUBLIC_NOT_FOUND
    const phone = trimOrNull(formValues.phone) || PUBLIC_NOT_FOUND
    const website = trimOrNull(formValues.website) || companyIntel.website || PUBLIC_NOT_FOUND
    const linkedinUrl = trimOrNull(formValues.linkedin_url) || detected?.linkedin_url || PUBLIC_NOT_FOUND
    const companyLinkedInUrl = companyIntel.linkedin_company_url ?? "—"
    const seedKey = JSON.stringify(buildCompanySeed(input))
    if (similarState.seedKey !== seedKey) {
      similarState = { seedKey, loading: false, matches: [] }
      renderSimilarCompanies([])
    }

    const verification = inferVerificationStatus({
      verification_status: input?.existingLead?.verification_status,
      email_status: input?.existingLead?.email_status,
    })

    renderProfilePhoto(name, input?.profilePhotoUrl ?? detected?.profile_photo_url ?? null)
    setText("es-ws-profile-name", name)
    setText("es-ws-profile-title", title)
    setText("es-ws-profile-company", company)
    setText("es-ws-profile-location", profileLocation !== PUBLIC_NOT_FOUND ? profileLocation : PUBLIC_NOT_FOUND)

    renderContactIntelligence(input)

    console.log("[Equipify Sales:workspace]", "render_input_payload", {
      person: {
        name,
        title,
        company,
        location: profileLocation,
        profilePhotoUrl: input?.profilePhotoUrl ?? detected?.profile_photo_url ?? null,
        linkedinUrl,
      },
      company: {
        name: companyName,
        logoUrl: companyIntel.company_logo_url ?? null,
        linkedinCompanyUrl: companyLinkedInUrl,
      },
      detected: detected
        ? {
            contact_name: detected.contact_name ?? null,
            company_name: detected.company_name ?? null,
            headline: detected.headline ?? null,
            linkedin_page_kind: detected.linkedin_page_kind ?? null,
          }
        : null,
      hasMatch,
    })

    intelLog("overview", {
      name,
      title,
      company,
      companyIntel: companyName,
      hasWebsite: website !== PUBLIC_NOT_FOUND,
      hasMatch,
      pageKind: detected?.linkedin_page_kind ?? null,
    })

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
      <div class="es-ws-kv-row"><span class="es-ws-kv-label">Email</span><span class="es-ws-kv-value">${escapeHtml(email)} <button type="button" class="es-ws-copy-btn" data-copy-value="${escapeHtml(email)}" ${email === PUBLIC_NOT_FOUND ? "hidden" : ""}>Copy</button></span></div>
      <div class="es-ws-kv-row"><span class="es-ws-kv-label">Phone</span><span class="es-ws-kv-value">${escapeHtml(phone)} <button type="button" class="es-ws-copy-btn" data-copy-value="${escapeHtml(phone)}" ${phone === PUBLIC_NOT_FOUND ? "hidden" : ""}>Copy</button></span></div>
      <div class="es-ws-kv-row"><span class="es-ws-kv-label">LinkedIn</span><span class="es-ws-kv-value">${linkedinUrl !== PUBLIC_NOT_FOUND ? `<a href="${escapeHtml(linkedinUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(linkedinUrl)}</a>` : escapeHtml(PUBLIC_NOT_FOUND)}</span></div>
      <div class="es-ws-kv-row"><span class="es-ws-kv-label">Website</span><span class="es-ws-kv-value">${website !== PUBLIC_NOT_FOUND ? `<a href="${escapeHtml(website)}" target="_blank" rel="noopener noreferrer">${escapeHtml(website)}</a>` : escapeHtml(PUBLIC_NOT_FOUND)}</span></div>
      <div class="es-ws-kv-row"><span class="es-ws-kv-label">Verification</span><span class="es-ws-kv-value"><span class="es-ws-verify-pill" data-status="${verification}">${verificationLabel(verification)}</span></span></div>
    `)

    document.querySelectorAll(".es-ws-copy-btn").forEach((btn) => {
      btn.addEventListener("click", () => copyText(btn.dataset.copyValue))
    })

    const verifyBtn = document.getElementById("es-ws-verify-email-btn")
    if (verifyBtn) {
      verifyBtn.hidden = email === PUBLIC_NOT_FOUND || verification === "verified"
    }

    const relationship = linkedinStatus?.formatCompanyRelationshipStatus?.(crmPayload) ?? "Not Added"
    const contactsCount = context?.company_contacts_count ?? 0
    const oppCount = context?.opportunity?.id ? 1 : 0
    const customerCount = linkedinStatus?.isCustomerLeadStatus?.(context?.lead_status) ? 1 : 0

    const companyNameEl = document.getElementById("es-ws-company-name")
    if (companyNameEl) companyNameEl.textContent = hasCompany ? companyName : COMPANY_NOT_DETECTED
    const companySubtitle = document.getElementById("es-ws-company-subtitle")
    if (companySubtitle && hasCompany) {
      companySubtitle.textContent =
        [companyIntel.industry, companyLocation !== COMPANY_NOT_FOUND ? companyLocation : null]
          .filter(Boolean)
          .join(" · ") || "Company intelligence from public LinkedIn metadata"
    }
    const companyLogo = document.getElementById("es-ws-company-logo")
    if (companyLogo) {
      const logoUrl = trimOrNull(companyIntel.company_logo_url)
      if (logoUrl) {
        companyLogo.innerHTML = `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(companyName)} logo" />`
      } else {
        companyLogo.textContent = initials(companyName)
      }
    }

    const enrichBtn = document.getElementById("es-ws-enrich-company-btn")
    if (enrichBtn) {
      enrichBtn.hidden =
        !hasCompany || !trimOrNull(detected?.linkedin_company_url ?? companyIntel.linkedin_company_url)
    }
    const visitCompanyBtn = document.getElementById("es-ws-visit-company-btn")
    if (visitCompanyBtn) {
      visitCompanyBtn.hidden =
        !hasCompany || !trimOrNull(detected?.linkedin_company_url ?? companyIntel.linkedin_company_url)
    }

    if (!hasCompany) {
      renderKvList("es-ws-company-rows", [])
      setText("es-ws-company-contacts-count", "0")
      setText("es-ws-company-opportunities-count", "0")
      setText("es-ws-company-customers-count", "0")
    } else {
      renderKvList("es-ws-company-rows", [
      { label: "Company", value: companyName },
      {
        label: "Website",
        value: website !== PUBLIC_NOT_FOUND ? website : companyValue(companyIntel.website),
        html:
          website !== PUBLIC_NOT_FOUND
            ? `<a href="${escapeHtml(website)}" target="_blank" rel="noopener noreferrer">${escapeHtml(website)}</a>`
            : companyIntel.website
              ? `<a href="${escapeHtml(companyIntel.website)}" target="_blank" rel="noopener noreferrer">${escapeHtml(companyIntel.website)}</a>`
              : null,
      },
      {
        label: "LinkedIn",
        value: companyLinkedInUrl,
        html:
          companyLinkedInUrl !== "—"
            ? `<a href="${escapeHtml(companyLinkedInUrl)}" target="_blank" rel="noopener noreferrer">Company page</a>`
            : null,
      },
      { label: "About", value: companyValue(companyIntel.company_description) },
      { label: "Headquarters", value: companyLocation },
      {
        label: "Offices",
        value:
          Array.isArray(companyIntel.office_locations) && companyIntel.office_locations.length
            ? companyIntel.office_locations.join(", ")
            : null,
      },
      { label: "Industry", value: companyValue(companyIntel.industry) },
      {
        label: "Keywords",
        value:
          Array.isArray(companyIntel.keywords) && companyIntel.keywords.length
            ? companyIntel.keywords.join(", ")
            : null,
      },
      { label: "Employees", value: companyValue(companyIntel.employee_count) },
      { label: "Employee range", value: companyValue(companyIntel.employee_range) },
      { label: "Founded", value: companyValue(companyIntel.founded) },
      { label: "Followers", value: followersValue(companyIntel.followers_count) },
      { label: "Company type", value: companyValue(companyIntel.company_type) },
    ])

      setText("es-ws-company-contacts-count", String(contactsCount))
      setText("es-ws-company-opportunities-count", String(oppCount))
      setText("es-ws-company-customers-count", String(customerCount))
    }

    const nba = resolveNextBestAction(context, crmPayload, hasMatch)
    setText("es-ws-nba-label", nba.label)
    setText("es-ws-nba-reason", nba.reason ?? "")
    const nbaBtn = document.getElementById("es-ws-nba-cta")
    if (nbaBtn) {
      nbaBtn.textContent = nba.cta
      nbaBtn.dataset.action = nba.action
    }

    renderResearchSnapshot(context, detected, formValues)
    renderTimeline(context)
    renderQueueShortcuts(recentCaptures)
    renderEmployees(context, input?.visibleLinkedInPeople ?? [], detected, formValues)
    renderCrmContacts(context)
    renderTechnologies(detected, context)
    renderSignals(detected, context)
    renderCrmRelationship(context, relationship, contactsCount, oppCount, customerCount, hasMatch)

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
    const objectRow = window.EquipifyGrowthEmployeeRow
    if (!list) return
    const visibleMatches = applySimilarFilters(matches)
    if (!matches.length) {
      list.innerHTML =
        '<p class="es-ws-empty">No similar companies loaded yet. Use Discovery Actions to run Similar Company Discovery.</p>'
      if (insight) insight.textContent = "Similar company discovery requires a matched CRM lead or captured company context."
      return
    }
    if (!visibleMatches.length) {
      list.innerHTML =
        '<p class="es-ws-empty">No similar companies match the selected filters. Expand the search radius or clear filters.</p>'
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
      .slice(0, 8)
      .map((match) => {
        const reasons = similarityReasons(match).join(" · ")
        const inCrm = Boolean(trimOrNull(match.lead_id))
        return (
          objectRow?.buildObjectRowHtml?.(
            {
              name: match.company_name,
              title: match.location ?? "Location unknown",
              meta: `${crmBadgeForSimilar(match)} · ${reasons}`,
              website: match.website,
              lead_id: match.lead_id ?? null,
              company_name: match.company_name,
              source: "similar_company",
            },
            escapeHtml,
            {
              secondaryLabel: inCrm ? "Open" : "Add",
              secondaryActionKind: inCrm ? "open-lead" : "queue",
            },
          ) ?? ""
        )
      })
      .join("")
    objectRow?.bindObjectRowActions?.(list)
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
      if (tabId === "discovery") {
        intelLog("discovery_tab", { pageKind: lastRenderInput?.detected?.linkedin_page_kind ?? null })
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

    async function runCompanyPageEnrichment() {
      const detected = lastRenderInput?.detected ?? {}
      const companyUrl = trimOrNull(detected?.linkedin_company_url)
      if (!companyUrl) {
        setCompanyEnrichmentStatus("No LinkedIn company page URL detected on this profile.")
        return
      }
      setCompanyEnrichmentStatus("Fetching public company metadata from LinkedIn (operator-triggered)…")
      try {
        const response = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: "equipify-enrich-company-page", url: companyUrl }, resolve)
        })
        if (!response?.ok || !response.metadata) {
          setCompanyEnrichmentStatus(response?.message ?? "Could not enrich company page.")
          return
        }
        lastCompanyEnrichment = response.metadata
        if (Array.isArray(response.visiblePeople) && response.visiblePeople.length) {
          lastRenderInput = {
            ...(lastRenderInput ?? {}),
            visibleLinkedInPeople: response.visiblePeople,
          }
        }
        setCompanyEnrichmentStatus(
          `Enriched from public company page · ${response.metadata.company_name ?? "company metadata loaded"}`,
        )
        render(lastRenderInput ?? {})
      } catch (error) {
        setCompanyEnrichmentStatus(error instanceof Error ? error.message : "Company enrichment failed.")
      }
    }

    document.getElementById("workspace-refresh-btn")?.addEventListener("click", () => {
      deps?.refresh?.()
    })

    document.querySelectorAll("[data-company-tab]").forEach((button) => {
      button.addEventListener("click", () => switchCompanyTab(button.dataset.companyTab))
    })

    const refreshEmployeeFilters = () => renderFilteredEmployees(lastRenderInput?.detected ?? null)
    ;[
      "es-ws-employee-search",
      "es-ws-employee-department-filter",
      "es-ws-employee-seniority-filter",
      "es-ws-employee-crm-filter",
    ].forEach((id) => {
      document.getElementById(id)?.addEventListener("input", refreshEmployeeFilters)
      document.getElementById(id)?.addEventListener("change", refreshEmployeeFilters)
    })

    document.getElementById("es-ws-add-btn")?.addEventListener("click", () => {
      if (typeof deps?.submitCapture === "function") {
        deps.submitCapture().catch(() => {})
        return
      }
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

    document.getElementById("es-ws-enrich-company-btn")?.addEventListener("click", () => {
      void runCompanyPageEnrichment()
    })

    document.getElementById("es-ws-visit-company-btn")?.addEventListener("click", () => {
      const url = trimOrNull(lastRenderInput?.detected?.linkedin_company_url)
      if (url) window.open(url, "_blank", "noopener,noreferrer")
    })

    document.getElementById("es-ws-discover-similar-btn")?.addEventListener("click", () => {
      discoverSimilarCompanies()
    })

    document.querySelectorAll("[data-similar-filter]").forEach((input) => {
      input.addEventListener("change", () => renderSimilarCompanies())
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
