/**
 * Employee row URL resolution and action wiring for Company Intelligence.
 */
;(function initEquipifyGrowthEmployeeRow() {
  function trimOrNull(value) {
    const trimmed = typeof value === "string" ? value.trim() : String(value ?? "").trim()
    return trimmed ? trimmed : null
  }

  function resolveEmployeeViewUrl(contact) {
    if (!contact || typeof contact !== "object") return null
    return (
      trimOrNull(contact.linkedin_url) ||
      trimOrNull(contact.profile_url) ||
      trimOrNull(contact.source_url) ||
      null
    )
  }

  function resolveEmployeeAddLabel(contact) {
    if (trimOrNull(contact?.lead_id)) return "Open"
    return "Add"
  }

  function buildEmployeeRowHtml(contact, escapeHtml) {
    const safeEscape =
      typeof escapeHtml === "function"
        ? escapeHtml
        : (value) =>
            String(value ?? "")
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")

    const viewUrl = resolveEmployeeViewUrl(contact)
    const addLabel = resolveEmployeeAddLabel(contact)
    const viewDisabled = !viewUrl
    const viewTitle = viewUrl ? "View public profile" : "No public profile available"

    return `
          <div class="es-ws-employee-row" data-employee-source="${safeEscape(contact.source ?? "")}">
            <div class="es-ws-employee-copy">
              <div class="es-ws-employee-name">${safeEscape(contact.name ?? "Company contact")}</div>
              <div class="es-ws-employee-title">${safeEscape(contact.title ?? "Title unknown")}</div>
              <div class="es-ws-employee-meta">${safeEscape(contact.department)} · ${safeEscape(contact.seniority)} · ${safeEscape(contact.crm_status)}</div>
            </div>
            <div class="es-ws-employee-actions">
              <button type="button" class="es-ws-employee-action es-ws-employee-view" data-view-url="${safeEscape(viewUrl ?? "")}" ${viewDisabled ? "disabled" : ""} title="${safeEscape(viewTitle)}" aria-label="${safeEscape(viewTitle)}">View</button>
              <button type="button" class="es-ws-employee-action es-ws-employee-add" data-lead-id="${safeEscape(contact.lead_id ?? "")}" aria-label="${safeEscape(addLabel)}">${safeEscape(addLabel)}</button>
            </div>
          </div>
        `
  }

  function defaultOpenViewUrl(url) {
    window.open(url, "_blank", "noopener,noreferrer")
  }

  function defaultTriggerAdd() {
    document.getElementById("linkedin-add-btn")?.click()
  }

  function defaultTriggerOpenLead() {
    document.getElementById("linkedin-open-lead-btn")?.click()
  }

  function bindEmployeeRowActions(list, deps = {}) {
    if (!list) return

    const openViewUrl = deps.openViewUrl ?? defaultOpenViewUrl
    const triggerAdd = deps.triggerAdd ?? defaultTriggerAdd
    const triggerOpenLead = deps.triggerOpenLead ?? defaultTriggerOpenLead

    list.querySelectorAll(".es-ws-employee-view:not([disabled])").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.preventDefault()
        event.stopPropagation()
        const url = trimOrNull(btn.getAttribute("data-view-url"))
        if (url) openViewUrl(url)
      })
    })

    list.querySelectorAll(".es-ws-employee-add").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.preventDefault()
        const leadId = trimOrNull(btn.getAttribute("data-lead-id"))
        if (leadId) triggerOpenLead(leadId)
        else triggerAdd()
      })
    })
  }

  window.EquipifyGrowthEmployeeRow = {
    trimOrNull,
    resolveEmployeeViewUrl,
    resolveEmployeeAddLabel,
    buildEmployeeRowHtml,
    bindEmployeeRowActions,
  }
})()
