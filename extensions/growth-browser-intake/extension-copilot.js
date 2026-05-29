/**
 * Growth Copilot sidebar — tabbed operator workspace (V4 Phase 3).
 * Reuses existing browser-intake APIs. Operator-initiated only.
 */

function initExtensionCopilot(deps) {
  const config = window.EquipifyGrowthExtensionConfig
  const queue = window.EquipifyGrowthProspectQueue
  const analytics = window.EquipifyGrowthExtensionAnalytics

  const TAB_IDS = [
    "crm",
    "research",
    "call_prep",
    "similar",
    "relationship",
    "timeline",
    "notes",
    "queue",
    "analytics",
    "committee",
  ]

  const state = {
    activeTab: "crm",
    committeeCandidates: [],
    committeeLeadId: null,
    committeeCompanyName: null,
  }

  const els = {
    tabButtons: document.querySelectorAll("[data-copilot-tab-btn]"),
    tabPanels: document.querySelectorAll("[data-copilot-tab-panel]"),
    researchStatus: document.getElementById("copilot-research-status"),
    researchContent: document.getElementById("copilot-research-content"),
    generateResearchBtn: document.getElementById("copilot-generate-research-btn"),
    callPrepStatus: document.getElementById("copilot-call-prep-status"),
    callPrepContent: document.getElementById("copilot-call-prep-content"),
    generateCallPrepBtn: document.getElementById("copilot-generate-call-prep-btn"),
    similarStatus: document.getElementById("copilot-similar-status"),
    similarList: document.getElementById("copilot-similar-list"),
    findSimilarBtn: document.getElementById("copilot-find-similar-btn"),
    relationshipContent: document.getElementById("copilot-relationship-content"),
    timelineContent: document.getElementById("copilot-timeline-content"),
    notesInput: document.getElementById("copilot-notes-input"),
    notesSaveBtn: document.getElementById("copilot-notes-save-btn"),
    notesStatus: document.getElementById("copilot-notes-status"),
    committeePanel: document.getElementById("copilot-committee-panel"),
    committeeStatus: document.getElementById("copilot-committee-status"),
    committeeList: document.getElementById("copilot-committee-list"),
    discoverCommitteeBtn: document.getElementById("copilot-discover-committee-btn"),
    importCommitteeBtn: document.getElementById("copilot-import-committee-btn"),
    queueList: document.getElementById("copilot-queue-list"),
    addToQueueBtn: document.getElementById("copilot-add-to-queue-btn"),
    processQueueBtn: document.getElementById("copilot-process-queue-btn"),
    analyticsToday: document.getElementById("analytics-today"),
    analyticsWeek: document.getElementById("analytics-week"),
    analyticsMonth: document.getElementById("analytics-month"),
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/\n/g, "<br/>")
  }

  function setStatus(el, text, kind) {
    if (!el) return
    el.hidden = !text
    el.textContent = text ?? ""
    el.className = `message ${kind === "error" ? "message-error" : kind === "success" ? "message-success" : ""}`
  }

  function buildSeedPayload() {
    const form = deps.readFormValues()
    const detected = deps.getDetected?.() ?? null
    const crm = deps.getCrmContext?.() ?? null
    return {
      lead_id: crm?.lead_id ?? deps.getExistingLeadId?.() ?? null,
      company_name: form.company_name || detected?.company_name || crm?.company_name || null,
      website: form.website || detected?.website || null,
      linkedin_url: form.linkedin_url || detected?.linkedin_url || null,
      email: form.email || null,
      source_url: form.source_url || detected?.source_url || null,
      page_title: form.page_title || detected?.page_title || null,
      source_platform: form.source_platform || detected?.source_platform || "website",
    }
  }

  function formatRelativeWhen(value) {
    if (!value) return "—"
    const at = Date.parse(value)
    if (Number.isNaN(at)) return value
    const days = Math.floor((Date.now() - at) / 86_400_000)
    if (days <= 0) return "Today"
    if (days === 1) return "Yesterday"
    if (days < 14) return `${days} days ago`
    return new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric" })
  }

  function switchTab(tabId) {
    if (!TAB_IDS.includes(tabId)) return
    state.activeTab = tabId
    els.tabButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.copilotTabBtn === tabId)
    })
    els.tabPanels.forEach((panel) => {
      panel.hidden = panel.dataset.copilotTabPanel !== tabId
    })
    window.EquipifySalesExtensionUi?.updateSectionTitle?.(tabId)
    if (tabId === "relationship") renderRelationshipMap()
    if (tabId === "timeline") renderTimeline()
    if (tabId === "notes") loadNotesTab()
    if (tabId === "committee") updateCommitteeTabVisibility()
    if (tabId === "analytics") refreshAnalytics().catch(() => {})
    if (tabId === "queue") refreshQueueList().catch(() => {})
  }

  function renderRelationshipMap() {
    if (!els.relationshipContent) return
    const crm = deps.getCrmContext?.()
    const map = crm?.company_relationship_map
    if (!crm?.lead_id) {
      els.relationshipContent.innerHTML = `<p class="panel-empty">Match a lead to view company relationships.</p>`
      return
    }

    const stats = `
      <div class="es-stat-grid cols-3" style="margin-bottom: 12px">
        <div class="es-stat"><div class="es-stat-label">Contacts</div><div class="es-stat-value">${crm.company_contacts_count ?? 0}</div></div>
        <div class="es-stat"><div class="es-stat-label">Related leads</div><div class="es-stat-value">${crm.related_leads_count ?? 0}</div></div>
        <div class="es-stat"><div class="es-stat-label">Owner</div><div class="es-stat-value" style="font-size:12px">${escapeHtml(crm.owner?.display_name || crm.owner?.email || "Unassigned")}</div></div>
      </div>`

    const contacts = (map?.contacts ?? [])
      .map(
        (row) =>
          `<div class="copilot-list-item"><strong>${escapeHtml(row.name)}</strong><div class="muted">${escapeHtml(row.title || "—")} · ${escapeHtml(row.status || "")}</div></div>`,
      )
      .join("")
    const related = (map?.related_leads ?? [])
      .map(
        (row) =>
          `<div class="copilot-list-item"><strong>${escapeHtml(row.name)}</strong><div class="muted">${escapeHtml(row.status || "")}</div></div>`,
      )
      .join("")

    const companyBtn = crm.links?.company
      ? `<div class="button-row" style="margin-top:10px"><a class="btn-secondary link-btn" href="${escapeHtml(crm.links.company)}" target="_blank" rel="noopener noreferrer">View company</a></div>`
      : ""

    els.relationshipContent.innerHTML = `${stats}
      <div class="copilot-subsection"><div class="panel-label">Decision makers & contacts</div>${contacts || '<p class="muted">None on file.</p>'}</div>
      <div class="copilot-subsection"><div class="panel-label">Related leads</div>${related || '<p class="muted">None on file.</p>'}</div>
      ${companyBtn}`
  }

  function renderTimeline() {
    if (!els.timelineContent) return
    const crm = deps.getCrmContext?.()
    const events = crm?.timeline_preview ?? []
    if (!events.length) {
      els.timelineContent.innerHTML = `<p class="panel-empty">No timeline events yet.</p>`
      return
    }
    const leadLink = crm?.links?.lead
    els.timelineContent.innerHTML = `${events
      .map(
        (event) =>
          `<div class="es-timeline-item">
            <div class="es-timeline-dot"></div>
            <div>
              <div class="es-timeline-when">${escapeHtml(formatRelativeWhen(event.occurred_at))}</div>
              <div class="es-timeline-title">${escapeHtml(event.title || event.event_type || "Activity")}</div>
              <div class="es-timeline-summary">${escapeHtml(event.summary || "")}</div>
            </div>
          </div>`,
      )
      .join("")}
      ${leadLink ? `<div class="button-row" style="margin-top:8px"><a class="btn-secondary link-btn" href="${escapeHtml(leadLink)}" target="_blank" rel="noopener noreferrer">Open full timeline</a></div>` : ""}`
  }

  function loadNotesTab() {
    if (!els.notesInput) return
    const crm = deps.getCrmContext?.()
    els.notesInput.value = crm?.lead_notes ?? ""
    if (els.notesSaveBtn) els.notesSaveBtn.disabled = !crm?.lead_id
  }

  async function saveNotesTab() {
    const crm = deps.getCrmContext?.()
    const noteText = (els.notesInput?.value ?? "").trim()
    if (!crm?.lead_id || !noteText) return
    setStatus(els.notesStatus, "Saving note…", null)
    try {
      await deps.appendLeadNote?.(crm.lead_id, crm.lead_notes, noteText)
      setStatus(els.notesStatus, "Note saved.", "success")
      await deps.refreshCrmContext?.()
      loadNotesTab()
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save note."
      setStatus(els.notesStatus, message, "error")
    }
  }

  function renderResearchBrief(artifact) {
    if (!els.researchContent || !artifact) return
    const grid = [
      ["Company", artifact.company_summary],
      ["Why this account", artifact.why_this_account],
      ["Fit", artifact.fit_summary],
      ["Technology", artifact.technology_summary],
      ["Outreach angle", artifact.recommended_angle],
      ["Next step", artifact.recommended_next_step],
    ]
      .map(
        ([label, value]) =>
          `<div class="es-brief-section"><div class="es-brief-label">${label}</div><div class="es-brief-value">${escapeHtml(String(value ?? "—"))}</div></div>`,
      )
      .join("")

    const signals = [
      ...(artifact.growth_signals ?? []).map((v) => `Growth: ${v}`),
      ...(artifact.buying_signals ?? []).map((v) => `Buying: ${v}`),
      ...(artifact.pain_points ?? []).map((v) => `Pain: ${v}`),
    ]
    const signalBlock = signals.length
      ? `<div class="es-brief-section" style="grid-column: 1 / -1"><div class="es-brief-label">Signals</div><div class="es-brief-value">${escapeHtml(signals.map((s) => `• ${s}`).join("\n"))}</div></div>`
      : ""

    els.researchContent.innerHTML = grid + signalBlock
    els.researchContent.hidden = false
  }

  async function generateResearchBrief() {
    const seed = buildSeedPayload()
    if (!seed.lead_id && !seed.company_name) {
      setStatus(els.researchStatus, "Match or save a lead first.", "error")
      return
    }
    if (els.generateResearchBtn) els.generateResearchBtn.disabled = true
    setStatus(els.researchStatus, "Generating research brief…", null)
    try {
      const response = await fetch(`${deps.apiBaseUrl()}${config.RESEARCH_BRIEF_PATH}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(seed),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok || !body?.matched || !body?.artifact) {
        setStatus(els.researchStatus, body?.message || "Could not generate research brief.", "error")
        if (els.researchContent) els.researchContent.hidden = true
        return
      }
      renderResearchBrief(body.artifact)
      await analytics?.recordAnalyticsEvent?.("research_briefs_generated")
      await refreshAnalytics()
      setStatus(els.researchStatus, "Research brief ready.", "success")
    } catch (error) {
      setStatus(els.researchStatus, "Research brief failed.", "error")
    } finally {
      if (els.generateResearchBtn) els.generateResearchBtn.disabled = false
    }
  }

  function renderCallPrepArtifact(artifact) {
    if (!els.callPrepContent || !artifact) return
    const sections = [
      ["Who they are", artifact.who_they_are],
      ["Company overview", artifact.company_overview],
      ["Suggested opener", artifact.suggested_opener],
      ["Discovery questions", (artifact.discovery_questions ?? []).map((q) => `• ${q}`).join("\n")],
      ["Likely objections", (artifact.likely_objections ?? []).map((q) => `• ${q}`).join("\n")],
      ["Relevant signals", (artifact.relevant_signals ?? []).map((q) => `• ${q}`).join("\n")],
      ["Recommended next step", artifact.recommended_next_step],
    ]
    els.callPrepContent.innerHTML = sections
      .map(
        ([label, value]) =>
          `<div class="es-brief-section"><div class="es-brief-label">${label}</div><div class="es-brief-value">${escapeHtml(String(value ?? "—"))}</div></div>`,
      )
      .join("")
    els.callPrepContent.hidden = false
  }

  async function generateCallPrep() {
    const seed = buildSeedPayload()
    if (!seed.lead_id && !seed.company_name) {
      setStatus(els.callPrepStatus, "Match or save a lead first.", "error")
      return
    }
    if (els.generateCallPrepBtn) els.generateCallPrepBtn.disabled = true
    setStatus(els.callPrepStatus, "Generating call prep…", null)
    try {
      const response = await fetch(`${deps.apiBaseUrl()}${config.CALL_PREP_PATH}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(seed),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok || !body?.matched || !body?.artifact) {
        setStatus(els.callPrepStatus, body?.message || "Could not generate call prep.", "error")
        if (els.callPrepContent) els.callPrepContent.hidden = true
        return
      }
      renderCallPrepArtifact(body.artifact)
      await analytics?.recordAnalyticsEvent?.("call_preps_generated")
      await refreshAnalytics()
      setStatus(els.callPrepStatus, `Call prep ready (${body.artifact.data_completeness}).`, "success")
    } catch {
      setStatus(els.callPrepStatus, "Call prep failed.", "error")
    } finally {
      if (els.generateCallPrepBtn) els.generateCallPrepBtn.disabled = false
    }
  }

  async function findSimilarCompanies() {
    const seed = buildSeedPayload()
    if (!seed.lead_id && !seed.company_name) {
      setStatus(els.similarStatus, "Add a company seed first.", "error")
      return
    }
    if (els.findSimilarBtn) els.findSimilarBtn.disabled = true
    setStatus(els.similarStatus, "Finding similar companies…", null)
    try {
      const response = await fetch(`${deps.apiBaseUrl()}${config.SIMILAR_COMPANIES_PATH}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...seed, limit: 5 }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok || !body?.ok) {
        setStatus(els.similarStatus, body?.message || "Discovery failed.", "error")
        if (els.similarList) els.similarList.innerHTML = ""
        return
      }
      if (els.similarList) {
        els.similarList.innerHTML = (body.matches ?? [])
          .map(
            (match) =>
              `<div class="phase2-similar-item"><div class="phase2-similar-title">${escapeHtml(match.company_name)}</div><div class="phase2-similar-meta muted">${escapeHtml(match.location || "—")} · ${match.confidence}%</div><div class="phase2-similar-why">${escapeHtml(match.why_matched)}</div></div>`,
          )
          .join("") || `<p class="muted">No similar companies found.</p>`
      }
      setStatus(els.similarStatus, `Found ${body.match_count ?? 0} companies.`, "success")
    } catch {
      setStatus(els.similarStatus, "Discovery failed.", "error")
    } finally {
      if (els.findSimilarBtn) els.findSimilarBtn.disabled = false
    }
  }

  function updateCommitteeTabVisibility() {
    const pageKind = deps.getLinkedInPageKind?.()
    const committeeBtn = document.querySelector('[data-copilot-tab-btn="committee"]')
    if (committeeBtn) committeeBtn.hidden = pageKind !== "company"
    if (els.committeePanel) els.committeePanel.hidden = pageKind !== "company"
  }

  function renderCommitteeCandidates(candidates) {
    if (!els.committeeList) return
    if (!candidates.length) {
      els.committeeList.innerHTML = `<p class="muted">No candidates found. Run discovery on a LinkedIn company page.</p>`
      return
    }
    els.committeeList.innerHTML = candidates
      .map(
        (candidate) => `
        <label class="committee-row">
          <input type="checkbox" class="committee-select" data-candidate-id="${escapeHtml(candidate.candidate_id)}" ${candidate.already_imported ? "disabled" : ""} />
          <div>
            <strong>${escapeHtml(candidate.full_name)}</strong>
            <div class="muted">${escapeHtml(candidate.job_title || candidate.matched_target_role || "—")} · ${candidate.confidence}% · ${escapeHtml(candidate.source)}</div>
            ${candidate.linkedin_url ? `<div class="muted">${escapeHtml(candidate.linkedin_url)}</div>` : ""}
            ${candidate.email ? `<div class="muted">${escapeHtml(candidate.email)}</div>` : ""}
            ${candidate.phone ? `<div class="muted">${escapeHtml(candidate.phone)}</div>` : ""}
          </div>
        </label>`,
      )
      .join("")
  }

  async function extractVisibleCompanyPeople() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
      const tab = tabs[0]
      if (!tab?.id || !tab.url?.includes("linkedin.com/company")) return []
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["linkedin-company-people.js"] })
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.__equipifyGrowthLinkedInCompanyPeople?.() ?? [],
      })
      return Array.isArray(result) ? result : []
    } catch {
      return []
    }
  }

  async function discoverBuyingCommittee() {
    const seed = buildSeedPayload()
    if (!seed.company_name) {
      setStatus(els.committeeStatus, "Open a LinkedIn company page first.", "error")
      return
    }
    if (els.discoverCommitteeBtn) els.discoverCommitteeBtn.disabled = true
    setStatus(els.committeeStatus, "Discovering buying committee…", null)
    try {
      const visibleCandidates = await extractVisibleCompanyPeople()
      const response = await fetch(`${deps.apiBaseUrl()}${config.BUYING_COMMITTEE_DISCOVER_PATH}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...seed, visible_candidates: visibleCandidates }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok || !body?.discovery) {
        setStatus(els.committeeStatus, body?.message || "Discovery failed.", "error")
        return
      }
      state.committeeCandidates = body.discovery.candidates ?? []
      state.committeeLeadId = body.discovery.lead_id
      state.committeeCompanyName = body.discovery.company_name
      renderCommitteeCandidates(state.committeeCandidates)
      setStatus(els.committeeStatus, `Found ${state.committeeCandidates.length} candidates. Select contacts to import.`, "success")
    } catch {
      setStatus(els.committeeStatus, "Discovery failed.", "error")
    } finally {
      if (els.discoverCommitteeBtn) els.discoverCommitteeBtn.disabled = false
    }
  }

  async function importSelectedCommittee() {
    const selectedIds = [...document.querySelectorAll(".committee-select:checked")].map((el) =>
      el.getAttribute("data-candidate-id"),
    )
    const selections = state.committeeCandidates.filter((c) => selectedIds.includes(c.candidate_id))
    if (!selections.length) {
      setStatus(els.committeeStatus, "Select at least one contact to import.", "error")
      return
    }
    if (els.importCommitteeBtn) els.importCommitteeBtn.disabled = true
    setStatus(els.committeeStatus, "Importing selected contacts…", null)
    try {
      const seed = buildSeedPayload()
      const response = await fetch(`${deps.apiBaseUrl()}${config.BUYING_COMMITTEE_IMPORT_PATH}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: state.committeeCompanyName || seed.company_name,
          lead_id: state.committeeLeadId || seed.lead_id,
          website: seed.website,
          linkedin_url: seed.linkedin_url,
          source_url: seed.source_url,
          selections: selections.map((row) => ({
            candidate_id: row.candidate_id,
            full_name: row.full_name,
            job_title: row.job_title,
            linkedin_url: row.linkedin_url,
            email: row.email,
            phone: row.phone,
            source: row.source,
          })),
        }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok || !body?.ok) {
        setStatus(els.committeeStatus, body?.message || "Import failed.", "error")
        return
      }
      const imported = body.imported_count ?? 0
      for (let i = 0; i < imported; i += 1) {
        await analytics?.recordAnalyticsEvent?.("contacts_captured")
        await analytics?.recordAnalyticsEvent?.("captures_created")
      }
      await refreshAnalytics()
      await discoverBuyingCommittee()
      await deps.refreshCrmContext?.()
      setStatus(els.committeeStatus, `Imported ${imported} selected contact(s).`, "success")
    } catch {
      setStatus(els.committeeStatus, "Import failed.", "error")
    } finally {
      if (els.importCommitteeBtn) els.importCommitteeBtn.disabled = false
    }
  }

  async function refreshQueueList() {
    if (!els.queueList || !queue) return
    const items = await queue.loadProspectQueue()
    window.EquipifySalesExtensionUi?.updateQueueBadge?.(items.length)
    els.queueList.innerHTML = items.length
      ? items
          .map((item) => `<div class="copilot-list-item"><strong>${escapeHtml(item.company_name)}</strong><div class="muted">${escapeHtml(item.contact_name || item.kind)}</div></div>`)
          .join("")
      : `<p class="panel-empty">Queue empty — add the current page from CRM or here.</p>`
  }

  async function addToQueue() {
    const seed = buildSeedPayload()
    const form = deps.readFormValues()
    if (!seed.company_name) return
    await queue.addProspectQueueItem({
      kind: queue.inferQueueItemKind({
        linkedin_url: seed.linkedin_url,
        contact_name: form.contact_name,
        email: form.email,
        phone: form.phone,
      }),
      company_name: seed.company_name,
      contact_name: form.contact_name || null,
      title: form.title || null,
      email: form.email || null,
      phone: form.phone || null,
      website: seed.website,
      linkedin_url: seed.linkedin_url,
      source_url: seed.source_url,
      source_platform: seed.source_platform,
      page_title: seed.page_title,
      lead_id: seed.lead_id,
      notes: form.notes || null,
    })
    await analytics?.recordAnalyticsEvent?.("queue_saves")
    await refreshAnalytics()
    await refreshQueueList()
  }

  async function processQueue() {
    const items = await queue.loadProspectQueue()
    if (!items.length) return
    const response = await fetch(`${deps.apiBaseUrl()}${config.PROSPECT_QUEUE_PATH}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "process_queue", items }),
    })
    await response.json().catch(() => null)
    await refreshQueueList()
  }

  async function refreshAnalytics() {
    if (!analytics) return
    const [today, week, month] = await Promise.all([
      analytics.getAnalyticsSummary("today"),
      analytics.getAnalyticsSummary("week"),
      analytics.getAnalyticsSummary("month"),
    ])
    if (els.analyticsToday) els.analyticsToday.innerHTML = analytics.renderAnalyticsHtml(today)
    if (els.analyticsWeek) els.analyticsWeek.innerHTML = analytics.renderAnalyticsHtml(week)
    if (els.analyticsMonth) els.analyticsMonth.innerHTML = analytics.renderAnalyticsHtml(month)
  }

  function wireEvents() {
    els.tabButtons.forEach((button) => {
      button.addEventListener("click", () => switchTab(button.dataset.copilotTabBtn))
    })
    els.generateResearchBtn?.addEventListener("click", () => generateResearchBrief())
    els.generateCallPrepBtn?.addEventListener("click", () => generateCallPrep())
    els.findSimilarBtn?.addEventListener("click", () => findSimilarCompanies())
    els.notesSaveBtn?.addEventListener("click", () => saveNotesTab())
    els.discoverCommitteeBtn?.addEventListener("click", () => discoverBuyingCommittee())
    els.importCommitteeBtn?.addEventListener("click", () => importSelectedCommittee())
    els.addToQueueBtn?.addEventListener("click", () => addToQueue())
    els.processQueueBtn?.addEventListener("click", () => processQueue())
  }

  wireEvents()
  switchTab("crm")
  refreshQueueList().catch(() => {})
  refreshAnalytics().catch(() => {})
  updateCommitteeTabVisibility()

  return {
    switchTab,
    refreshAnalytics,
    updateCommitteeTabVisibility,
    renderRelationshipMap,
    renderTimeline,
  }
}

window.initExtensionCopilot = initExtensionCopilot
