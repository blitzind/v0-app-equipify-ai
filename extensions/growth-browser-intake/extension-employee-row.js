/**
 * Standard object row actions (View / Add / Open) for Equipify Sales workspace lists.
 */
;(function initEquipifyGrowthEmployeeRow() {
  function trimOrNull(value) {
    const trimmed = typeof value === "string" ? value.trim() : String(value ?? "").trim()
    return trimmed ? trimmed : null
  }

  function resolveViewUrl(record) {
    if (!record || typeof record !== "object") return null
    return (
      trimOrNull(record.linkedin_url) ||
      trimOrNull(record.profile_url) ||
      trimOrNull(record.source_url) ||
      trimOrNull(record.website) ||
      null
    )
  }

  function resolveSecondaryActionLabel(record) {
    if (trimOrNull(record?.lead_id)) return "Open"
    return "Add"
  }

  function resolveSecondaryActionKind(record, options = {}) {
    if (options.secondaryActionKind) return options.secondaryActionKind
    if (trimOrNull(record?.lead_id)) return "open-lead"
    if (options.secondaryActionKind === "queue") return "queue"
    return "add"
  }

  function buildObjectRowHtml(record, escapeHtml, options = {}) {
    const safeEscape =
      typeof escapeHtml === "function"
        ? escapeHtml
        : (value) =>
            String(value ?? "")
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")

    const name =
      trimOrNull(record?.name) ||
      trimOrNull(record?.company_name) ||
      trimOrNull(record?.contact_name) ||
      "Unknown"
    const subtitle = trimOrNull(record?.title) || trimOrNull(record?.subtitle) || "—"
    const meta = trimOrNull(record?.meta) || trimOrNull(record?.crm_status) || ""
    const buyingRole = trimOrNull(record?.buying_role)
    const buyingRoleBadge =
      buyingRole && buyingRole !== "Unknown"
        ? `<span class="es-ws-buying-role-badge" data-role="${safeEscape(buyingRole)}">${safeEscape(buyingRole)}</span>`
        : ""
    const viewUrl = resolveViewUrl(record)
    const secondaryLabel = options.secondaryLabel ?? resolveSecondaryActionLabel(record)
    const secondaryKind = resolveSecondaryActionKind(record, options)
    const viewDisabled = !viewUrl
    const viewTitle = viewUrl ? "View source profile or website" : "No public URL available"
    const rowClass = options.rowClass ?? "es-ws-employee-row"
    const showSecondary = options.showSecondary !== false

    return `
          <div class="${safeEscape(rowClass)}" data-row-source="${safeEscape(record?.source ?? "")}">
            <div class="es-ws-employee-copy">
              <div class="es-ws-employee-name">${safeEscape(name)}</div>
              <div class="es-ws-employee-title">${safeEscape(subtitle)}</div>
              ${buyingRoleBadge ? `<div class="es-ws-employee-badges">${buyingRoleBadge}</div>` : ""}
              ${meta ? `<div class="es-ws-employee-meta">${safeEscape(meta)}</div>` : ""}
            </div>
            <div class="es-ws-employee-actions">
              <button type="button" class="es-ws-employee-action es-ws-employee-view" data-view-url="${safeEscape(viewUrl ?? "")}" ${viewDisabled ? "disabled" : ""} title="${safeEscape(viewTitle)}" aria-label="${safeEscape(viewTitle)}">View</button>
              ${
                showSecondary
                  ? `<button type="button" class="es-ws-employee-action es-ws-employee-add" data-secondary-action="${safeEscape(secondaryKind)}" data-lead-id="${safeEscape(record?.lead_id ?? "")}" data-queue-company="${safeEscape(record?.company_name ?? record?.name ?? "")}" aria-label="${safeEscape(secondaryLabel)}">${safeEscape(secondaryLabel)}</button>`
                  : ""
              }
            </div>
          </div>
        `
  }

  function buildEmployeeRowHtml(contact, escapeHtml, options) {
    return buildObjectRowHtml(contact, escapeHtml, options)
  }

  function defaultOpenViewUrl(url) {
    window.open(url, "_blank", "noopener,noreferrer")
  }

  function defaultTriggerAdd() {
    document.getElementById("linkedin-add-btn")?.click()
  }

  function defaultTriggerOpenLead(leadId) {
    if (leadId && typeof window.__equipifyOpenLeadAdmin === "function") {
      window.__equipifyOpenLeadAdmin(leadId)
      return
    }
    document.getElementById("linkedin-open-lead-btn")?.click()
  }

  function defaultTriggerQueue(companyName) {
    window.__equipifyCopilotHooks?.switchTab?.("queue")
    document.getElementById("copilot-add-to-queue-btn")?.click()
    if (companyName) {
      console.log("[Equipify Sales:queue]", "similar_company_queued", { companyName })
    }
  }

  function bindObjectRowActions(list, deps = {}) {
    if (!list) return

    const openViewUrl = deps.openViewUrl ?? defaultOpenViewUrl
    const triggerAdd = deps.triggerAdd ?? defaultTriggerAdd
    const triggerOpenLead = deps.triggerOpenLead ?? defaultTriggerOpenLead
    const triggerQueue = deps.triggerQueue ?? defaultTriggerQueue

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
        const action = trimOrNull(btn.getAttribute("data-secondary-action")) ?? "add"
        const leadId = trimOrNull(btn.getAttribute("data-lead-id"))
        const queueCompany = trimOrNull(btn.getAttribute("data-queue-company"))
        if (action === "open-lead" && leadId) {
          triggerOpenLead(leadId)
          return
        }
        if (action === "queue") {
          triggerQueue(queueCompany)
          return
        }
        if (leadId) triggerOpenLead(leadId)
        else triggerAdd()
      })
    })
  }

  function bindEmployeeRowActions(list, deps) {
    bindObjectRowActions(list, deps)
  }

  window.EquipifyGrowthEmployeeRow = {
    trimOrNull,
    resolveViewUrl,
    resolveEmployeeViewUrl: resolveViewUrl,
    resolveEmployeeAddLabel: resolveSecondaryActionLabel,
    resolveSecondaryActionLabel,
    buildObjectRowHtml,
    buildEmployeeRowHtml,
    bindObjectRowActions,
    bindEmployeeRowActions,
  }
})()
