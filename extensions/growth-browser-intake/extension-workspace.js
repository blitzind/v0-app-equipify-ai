/**
 * Equipify Sales workspace renderer — Prospeo-style prospecting side panel.
 */
;(function initEquipifySalesWorkspace() {
  const linkedinStatus = window.EquipifyGrowthLinkedInStatus
  const crmContextUi = window.EquipifyGrowthCrmContext

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

  function render(input) {
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
      legacyBadge.className = `linkedin-status-badge badge-${display.tone}`
    }

    setHtml("es-ws-contact-rows", `
      <div class="es-ws-kv-row"><span class="es-ws-kv-label">Email</span><span class="es-ws-kv-value">${escapeHtml(email)}</span></div>
      <div class="es-ws-kv-row"><span class="es-ws-kv-label">Phone</span><span class="es-ws-kv-value">${escapeHtml(phone)}</span></div>
      <div class="es-ws-kv-row"><span class="es-ws-kv-label">LinkedIn</span><span class="es-ws-kv-value">${linkedinUrl !== "—" ? `<a href="${escapeHtml(linkedinUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(linkedinUrl)}</a>` : "—"}</span></div>
      <div class="es-ws-kv-row"><span class="es-ws-kv-label">Website</span><span class="es-ws-kv-value">${website !== "—" ? `<a href="${escapeHtml(website)}" target="_blank" rel="noopener noreferrer">${escapeHtml(website)}</a>` : "—"}</span></div>
      <div class="es-ws-kv-row"><span class="es-ws-kv-label">Verification</span><span class="es-ws-kv-value"><span class="es-ws-verify-pill" data-status="${verification}">${verificationLabel(verification)}</span></span></div>
    `)

    const verifyBtn = document.getElementById("es-ws-verify-email-btn")
    if (verifyBtn) {
      verifyBtn.hidden = email === "—" || verification === "verified"
    }

    const relationship = linkedinStatus?.formatCompanyRelationshipStatus?.(crmPayload) ?? "Not Added"
    const contactsCount = context?.company_contacts_count ?? 0
    const oppCount = context?.opportunity?.id ? 1 : 0
    const customerCount = linkedinStatus?.isCustomerLeadStatus?.(context?.lead_status) ? 1 : 0

    setHtml("es-ws-company-rows", `
      <div class="es-ws-kv-row"><span class="es-ws-kv-label">Company</span><span class="es-ws-kv-value">${escapeHtml(company)}</span></div>
      <div class="es-ws-kv-row"><span class="es-ws-kv-label">Website</span><span class="es-ws-kv-value">${website !== "—" ? escapeHtml(website) : "—"}</span></div>
      <div class="es-ws-kv-row"><span class="es-ws-kv-label">Industry</span><span class="es-ws-kv-value">${escapeHtml(trimOrNull(detected?.industry) ?? "—")}</span></div>
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

  function wireActions(deps) {
    document.getElementById("workspace-refresh-btn")?.addEventListener("click", () => {
      deps?.refresh?.()
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

    document.getElementById("es-ws-queue-recent")?.addEventListener("click", () => {
      document.getElementById("recent-captures-panel")?.scrollIntoView({ behavior: "smooth" })
    })
  }

  window.EquipifySalesWorkspace = {
    render,
    wireActions,
  }
})()
