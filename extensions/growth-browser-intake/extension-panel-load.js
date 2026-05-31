/**
 * Panel load skeletons, progressive hydration markers, and load audit (v4.3.39).
 */
;(function initEquipifyGrowthPanelLoad() {
  const LOG_PREFIX = "[Equipify Sales:panel-load]"

  const TIMEOUTS = {
    metadata: 1500,
    crm: 3000,
    company: 3000,
  }

  const audit = {
    startMs: typeof performance !== "undefined" ? performance.now() : Date.now(),
    shell_rendered_ms: null,
    profile_rendered_ms: null,
    metadata_received_ms: null,
    crm_lookup_ms: null,
    company_rendered_ms: null,
    first_contentful_panel_ms: null,
    blocked_on: null,
  }

  let auditFlushed = false

  function nowMs() {
    const base = typeof performance !== "undefined" ? performance.now() : Date.now()
    return Math.max(0, Math.round(base - audit.startMs))
  }

  function markFirstContentful() {
    if (audit.first_contentful_panel_ms == null) {
      audit.first_contentful_panel_ms = nowMs()
    }
  }

  function setBlockedOn(label) {
    if (label && !audit.blocked_on) audit.blocked_on = label
  }

  function clearBlockedOn(label) {
    if (!label || audit.blocked_on === label) audit.blocked_on = null
  }

  function skeletonNodes(key) {
    if (key) return Array.from(document.querySelectorAll(`[data-panel-skeleton="${key}"]`))
    return Array.from(document.querySelectorAll("[data-panel-skeleton]"))
  }

  function contentNodes(key) {
    return Array.from(document.querySelectorAll(`[data-panel-content="${key}"]`))
  }

  function showSkeletons() {
    skeletonNodes().forEach((node) => {
      node.hidden = false
    })
    contentNodes().forEach((node) => {
      node.hidden = true
    })
    document.body?.classList.add("es-panel-skeletons-active")
  }

  function hideSkeleton(key) {
    skeletonNodes(key).forEach((node) => {
      node.hidden = true
    })
    contentNodes(key).forEach((node) => {
      node.hidden = false
    })
    if (!skeletonNodes().some((node) => !node.hidden)) {
      document.body?.classList.remove("es-panel-skeletons-active")
    }
  }

  function hideAllSkeletons() {
    skeletonNodes().forEach((node) => {
      node.hidden = true
    })
    contentNodes().forEach((node) => {
      node.hidden = false
    })
    document.body?.classList.remove("es-panel-skeletons-active")
  }

  function buildAuditPayload() {
    return {
      shell_rendered_ms: audit.shell_rendered_ms,
      profile_rendered_ms: audit.profile_rendered_ms,
      metadata_received_ms: audit.metadata_received_ms,
      crm_lookup_ms: audit.crm_lookup_ms,
      company_rendered_ms: audit.company_rendered_ms,
      first_contentful_panel_ms: audit.first_contentful_panel_ms,
      blocked_on: audit.blocked_on,
    }
  }

  function emitAudit(force = false) {
    if (auditFlushed && !force) return
    console.log(LOG_PREFIX, buildAuditPayload())
  }

  function flushAudit() {
    auditFlushed = true
    emitAudit(true)
  }

  function markShellRendered() {
    if (audit.shell_rendered_ms == null) audit.shell_rendered_ms = nowMs()
    markFirstContentful()
    emitAudit()
  }

  function markProfileRendered() {
    if (audit.profile_rendered_ms == null) audit.profile_rendered_ms = nowMs()
    hideSkeleton("profile")
    markFirstContentful()
    clearBlockedOn("metadata")
    emitAudit()
  }

  function markMetadataReceived() {
    if (audit.metadata_received_ms == null) audit.metadata_received_ms = nowMs()
    clearBlockedOn("metadata")
    emitAudit()
  }

  function markCrmLookupComplete() {
    if (audit.crm_lookup_ms == null) audit.crm_lookup_ms = nowMs()
    hideSkeleton("contact-intelligence")
    hideSkeleton("opportunity-intelligence")
    clearBlockedOn("crm")
    emitAudit()
  }

  function markCompanyRendered() {
    if (audit.company_rendered_ms == null) audit.company_rendered_ms = nowMs()
    hideSkeleton("company-intelligence")
    clearBlockedOn("company")
    emitAudit()
  }

  function withTimeout(promise, ms, label) {
    return new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        setBlockedOn(label)
        reject(new Error(`${label}_timeout`))
      }, ms)
      Promise.resolve(promise)
        .then((value) => {
          window.clearTimeout(timeoutId)
          resolve(value)
        })
        .catch((error) => {
          window.clearTimeout(timeoutId)
          reject(error)
        })
    })
  }

  function showPartialRetry(targetKey, message) {
    const host = contentNodes(targetKey)[0] ?? skeletonNodes(targetKey)[0]
    if (!host) return
    let banner = host.querySelector(".es-panel-partial-retry")
    if (!banner) {
      banner = document.createElement("p")
      banner.className = "es-panel-partial-retry message message-warning"
      host.prepend(banner)
    }
    banner.textContent = message
    banner.hidden = false
  }

  window.EquipifyGrowthPanelLoad = {
    TIMEOUTS,
    showSkeletons,
    hideSkeleton,
    hideAllSkeletons,
    markShellRendered,
    markProfileRendered,
    markMetadataReceived,
    markCrmLookupComplete,
    markCompanyRendered,
    setBlockedOn,
    clearBlockedOn,
    withTimeout,
    showPartialRetry,
    emitAudit,
    flushAudit,
    buildAuditPayload,
  }
})()
