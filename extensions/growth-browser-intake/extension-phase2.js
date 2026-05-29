/**
 * Growth Browser Extension V4 Phase 2 — call prep, similar companies, prospect queue.
 * Operator-initiated only. No auto-messaging, sequences, or hidden scraping.
 */

function initExtensionPhase2(deps) {
  const config = window.EquipifyGrowthExtensionConfig
  const queue = window.EquipifyGrowthProspectQueue

  const els = {
    callPrepPanel: document.getElementById("phase2-call-prep-panel"),
    callPrepStatus: document.getElementById("phase2-call-prep-status"),
    callPrepContent: document.getElementById("phase2-call-prep-content"),
    generateCallPrepBtn: document.getElementById("phase2-generate-call-prep-btn"),
    similarPanel: document.getElementById("phase2-similar-panel"),
    similarStatus: document.getElementById("phase2-similar-status"),
    similarList: document.getElementById("phase2-similar-list"),
    findSimilarBtn: document.getElementById("phase2-find-similar-btn"),
    queuePanel: document.getElementById("phase2-queue-panel"),
    queueList: document.getElementById("phase2-queue-list"),
    queueStatus: document.getElementById("phase2-queue-status"),
    addToQueueBtn: document.getElementById("phase2-add-to-queue-btn"),
    processQueueBtn: document.getElementById("phase2-process-queue-btn"),
    queueDiscoveryBtn: document.getElementById("phase2-queue-discovery-btn"),
    queueVerifyBtn: document.getElementById("phase2-queue-verify-btn"),
    queueCreateLeadsBtn: document.getElementById("phase2-queue-create-leads-btn"),
    clearQueueBtn: document.getElementById("phase2-clear-queue-btn"),
  }

  function setCallPrepStatus(text, kind) {
    if (!els.callPrepStatus) return
    els.callPrepStatus.hidden = !text
    els.callPrepStatus.textContent = text ?? ""
    els.callPrepStatus.className = `message ${kind === "error" ? "message-error" : kind === "success" ? "message-success" : ""}`
  }

  function setSimilarStatus(text, kind) {
    if (!els.similarStatus) return
    els.similarStatus.hidden = !text
    els.similarStatus.textContent = text ?? ""
    els.similarStatus.className = `message ${kind === "error" ? "message-error" : kind === "success" ? "message-success" : ""}`
  }

  function setQueueStatus(text, kind) {
    if (!els.queueStatus) return
    els.queueStatus.hidden = !text
    els.queueStatus.textContent = text ?? ""
    els.queueStatus.className = `message ${kind === "error" ? "message-error" : kind === "success" ? "message-success" : ""}`
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

  function escapeHtml(value) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/\n/g, "<br/>")
  }

  async function generateCallPrep() {
    const seed = buildSeedPayload()
    if (!seed.lead_id && !seed.company_name) {
      setCallPrepStatus("Add a company or match an existing lead first.", "error")
      return
    }

    if (els.generateCallPrepBtn) els.generateCallPrepBtn.disabled = true
    setCallPrepStatus("Generating call prep…", null)

    try {
      const response = await fetch(`${deps.apiBaseUrl()}${config.CALL_PREP_PATH}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(seed),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok || !body?.matched || !body?.artifact) {
        setCallPrepStatus(body?.message || "Could not generate call prep.", "error")
        if (els.callPrepContent) els.callPrepContent.hidden = true
        return
      }
      renderCallPrepArtifact(body.artifact)
      setCallPrepStatus(`Call prep ready (${body.artifact.data_completeness} data).`, "success")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Network error"
      setCallPrepStatus(`Call prep failed (${message}).`, "error")
    } finally {
      if (els.generateCallPrepBtn) els.generateCallPrepBtn.disabled = false
    }
  }

  function renderSimilarMatches(matches) {
    if (!els.similarList) return
    if (!matches?.length) {
      els.similarList.innerHTML = `<p class="muted">No similar companies found from current Growth Engine data.</p>`
      return
    }

    els.similarList.innerHTML = matches
      .map(
        (match) => `
        <div class="phase2-similar-item">
          <div class="phase2-similar-title">${escapeHtml(match.company_name)}</div>
          <div class="phase2-similar-meta muted">${escapeHtml(match.location || "Location unknown")} · ${match.confidence}% confidence</div>
          <div class="phase2-similar-why">${escapeHtml(match.why_matched)}</div>
          ${match.website ? `<div class="phase2-similar-link muted">${escapeHtml(match.website)}</div>` : ""}
        </div>`,
      )
      .join("")
  }

  async function findSimilarCompanies() {
    const seed = buildSeedPayload()
    if (!seed.lead_id && !seed.company_name) {
      setSimilarStatus("Add a company name or match a lead to use as seed.", "error")
      return
    }

    if (els.findSimilarBtn) els.findSimilarBtn.disabled = true
    setSimilarStatus("Finding similar companies…", null)

    try {
      const response = await fetch(`${deps.apiBaseUrl()}${config.SIMILAR_COMPANIES_PATH}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...seed, limit: 5 }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok || !body?.ok) {
        setSimilarStatus(body?.message || "Similar company discovery failed.", "error")
        renderSimilarMatches([])
        return
      }
      renderSimilarMatches(body.matches ?? [])
      setSimilarStatus(`Found ${body.match_count ?? 0} similar companies.`, "success")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Network error"
      setSimilarStatus(`Discovery failed (${message}).`, "error")
    } finally {
      if (els.findSimilarBtn) els.findSimilarBtn.disabled = false
    }
  }

  function renderQueueItems(items) {
    if (!els.queueList) return
    if (!items.length) {
      els.queueList.innerHTML = `<p class="muted">Queue is empty. Save the current page to process later.</p>`
      return
    }

    els.queueList.innerHTML = items
      .map((item) => {
        const label =
          item.kind === "linkedin_page"
            ? "LinkedIn page"
            : item.kind === "contact"
              ? "Contact"
              : "Company"
        const subtitle = [item.contact_name, item.email, item.linkedin_url].filter(Boolean).join(" · ")
        return `
        <div class="phase2-queue-item" data-queue-id="${escapeHtml(item.queue_item_id)}">
          <div class="phase2-queue-row">
            <span class="badge">${escapeHtml(label)}</span>
            <strong>${escapeHtml(item.company_name)}</strong>
          </div>
          ${subtitle ? `<div class="muted">${escapeHtml(subtitle)}</div>` : ""}
          <button type="button" class="btn-link phase2-remove-queue-btn" data-queue-id="${escapeHtml(item.queue_item_id)}">Remove</button>
        </div>`
      })
      .join("")

    els.queueList.querySelectorAll(".phase2-remove-queue-btn").forEach((button) => {
      button.addEventListener("click", async () => {
        const queueId = button.getAttribute("data-queue-id")
        if (!queueId) return
        await queue.removeProspectQueueItem(queueId)
        await refreshQueue()
        setQueueStatus("Removed from queue.", "success")
      })
    })
  }

  async function refreshQueue() {
    const items = await queue.loadProspectQueue()
    renderQueueItems(items)
    window.EquipifySalesExtensionUi?.updateQueueBadge?.(items.length)
    return items
  }

  async function addCurrentPageToQueue() {
    const seed = buildSeedPayload()
    const form = deps.readFormValues()
    const companyName = seed.company_name
    if (!companyName) {
      setQueueStatus("Company name is required to queue this page.", "error")
      return
    }

    const item = {
      kind: queue.inferQueueItemKind({
        linkedin_url: seed.linkedin_url,
        contact_name: form.contact_name,
        email: form.email,
        phone: form.phone,
      }),
      company_name: companyName,
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
    }

    await queue.addProspectQueueItem(item)
    await refreshQueue()
    setQueueStatus("Added to prospect queue.", "success")
  }

  async function runQueueAction(action, buttonEl) {
    const items = await queue.loadProspectQueue()
    if (!items.length) {
      setQueueStatus("Queue is empty.", "error")
      return
    }

    const buttons = [
      els.processQueueBtn,
      els.queueDiscoveryBtn,
      els.queueVerifyBtn,
      els.queueCreateLeadsBtn,
    ]
    buttons.forEach((btn) => {
      if (btn) btn.disabled = true
    })
    if (buttonEl) buttonEl.disabled = true
    setQueueStatus(`Running ${action.replace(/_/g, " ")}…`, null)

    try {
      const response = await fetch(`${deps.apiBaseUrl()}${config.PROSPECT_QUEUE_PATH}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, items }),
      })
      const body = await response.json().catch(() => null)
      const result = body?.result
      if (!response.ok || !body?.ok || !result) {
        setQueueStatus(body?.message || "Queue action failed.", "error")
        return
      }

      for (const itemResult of result.results ?? []) {
        if (itemResult.lead_id) {
          await queue.updateProspectQueueItem(itemResult.queue_item_id, {
            lead_id: itemResult.lead_id,
          })
        }
      }

      await refreshQueue()
      setQueueStatus(
        `${action.replace(/_/g, " ")} complete — ${result.success_count}/${result.processed_count} succeeded.`,
        result.success_count === result.processed_count ? "success" : "error",
      )
      deps.setStatus?.(`Prospect queue: ${result.success_count}/${result.processed_count} succeeded.`, "success")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Network error"
      setQueueStatus(`Queue action failed (${message}).`, "error")
    } finally {
      buttons.forEach((btn) => {
        if (btn) btn.disabled = false
      })
    }
  }

  function wireEvents() {
    els.generateCallPrepBtn?.addEventListener("click", () => {
      generateCallPrep().catch(() => setCallPrepStatus("Call prep failed.", "error"))
    })
    els.findSimilarBtn?.addEventListener("click", () => {
      findSimilarCompanies().catch(() => setSimilarStatus("Discovery failed.", "error"))
    })
    els.addToQueueBtn?.addEventListener("click", () => {
      addCurrentPageToQueue().catch(() => setQueueStatus("Could not add to queue.", "error"))
    })
    els.processQueueBtn?.addEventListener("click", () => {
      runQueueAction("process_queue", els.processQueueBtn).catch(() =>
        setQueueStatus("Process queue failed.", "error"),
      )
    })
    els.queueDiscoveryBtn?.addEventListener("click", () => {
      runQueueAction("run_contact_discovery", els.queueDiscoveryBtn).catch(() =>
        setQueueStatus("Contact discovery queue failed.", "error"),
      )
    })
    els.queueVerifyBtn?.addEventListener("click", () => {
      runQueueAction("verify_emails", els.queueVerifyBtn).catch(() =>
        setQueueStatus("Email verification failed.", "error"),
      )
    })
    els.queueCreateLeadsBtn?.addEventListener("click", () => {
      runQueueAction("create_leads", els.queueCreateLeadsBtn).catch(() =>
        setQueueStatus("Create leads failed.", "error"),
      )
    })
    els.clearQueueBtn?.addEventListener("click", () => {
      queue
        .clearProspectQueue()
        .then(refreshQueue)
        .then(() => setQueueStatus("Queue cleared.", "success"))
        .catch(() => setQueueStatus("Could not clear queue.", "error"))
    })
  }

  wireEvents()
  refreshQueue().catch(() => {})

  return {
    refreshQueue,
    generateCallPrep,
    findSimilarCompanies,
  }
}

window.initExtensionPhase2 = initExtensionPhase2
