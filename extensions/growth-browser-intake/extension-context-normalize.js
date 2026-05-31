/**
 * Normalized extraction payload + context status for Equipify Sales sidebar.
 */
;(function initEquipifyGrowthContextNormalize() {
  const LOG_PREFIX = "[Equipify Sales:context-status]"

  function trimOrNull(value) {
    const trimmed = typeof value === "string" ? value.trim() : String(value ?? "").trim()
    return trimmed ? trimmed : null
  }

  function inferProfileNameFromPageTitle(pageTitle) {
    const raw = trimOrNull(pageTitle)
    if (!raw) return null
    const withoutLinkedIn = raw.replace(/\s*[|\-–—]\s*LinkedIn\s*$/i, "").trim()
    const firstSegment = withoutLinkedIn.split(/\s*[|\-–—]\s*/)[0]?.trim()
    if (!firstSegment) return null
    return trimOrNull(firstSegment.split(/\s+-\s+/)[0]?.trim() ?? firstSegment)
  }

  function parseHeadlineParts(headline) {
    const raw = trimOrNull(headline)
    if (!raw) return { title: null, company: null }
    if (typeof window.__equipifyGrowthParseLinkedInHeadline === "function") {
      return window.__equipifyGrowthParseLinkedInHeadline(raw)
    }
    const atMatch = raw.match(/^(.+?)\s+at\s+(.+?)(?:\s*[|·].*)?$/i)
    if (atMatch) {
      return { title: trimOrNull(atMatch[1]), company: trimOrNull(atMatch[2]) }
    }
    return { title: raw, company: null }
  }

  function normalizeExtractionPayload(input = {}) {
    const detected = input.detected ?? null
    const formValues = input.formValues ?? {}
    const context = input.context ?? null
    const headline = trimOrNull(detected?.raw_headline) || trimOrNull(detected?.headline)
    const headlineParts = parseHeadlineParts(headline)

    let person =
      trimOrNull(context?.contact_name) ||
      trimOrNull(formValues?.contact_name) ||
      trimOrNull(detected?.contact_name)

    if (!person && detected?.linkedin_page_kind === "profile") {
      person = inferProfileNameFromPageTitle(detected?.page_title)
    }

    const title =
      trimOrNull(formValues?.title) ||
      trimOrNull(detected?.job_title) ||
      trimOrNull(detected?.title) ||
      headlineParts.title

    const company =
      trimOrNull(context?.company_name) ||
      trimOrNull(formValues?.company_name) ||
      trimOrNull(detected?.company_name) ||
      headlineParts.company

    const location = trimOrNull(formValues?.location) || trimOrNull(detected?.location)
    const linkedinUrl = trimOrNull(formValues?.linkedin_url) || trimOrNull(detected?.linkedin_url)
    const pageKind = trimOrNull(detected?.linkedin_page_kind)

    const hasContext = Boolean(trimOrNull(person) || trimOrNull(company))

    return {
      person,
      title,
      company,
      location,
      linkedinUrl,
      pageKind,
      hasContext,
    }
  }

  function buildResearchSnapshotLines(normalized) {
    return [
      { label: "Person", value: normalized?.person ?? null },
      { label: "Title", value: normalized?.title ?? null },
      { label: "Company", value: normalized?.company ?? null },
      { label: "Location", value: normalized?.location ?? null },
    ]
  }

  function resolveContextStatusLabel(input = {}) {
    const extraction = input.normalized ?? normalizeExtractionPayload(input)
    const crmPayload = input.crmPayload ?? null
    const tabUrl = input.tabUrl ?? null
    const restricted =
      typeof input.isRestrictedTabUrl === "function" ? input.isRestrictedTabUrl(tabUrl) : input.restricted === true

    if (restricted) {
      return { label: "No context found", tone: "status-error", extraction }
    }
    if (crmPayload?.error_status === 403) {
      return { label: "Not authorized", tone: "status-error", extraction }
    }
    if (crmPayload?.error_status) {
      return { label: "Error", tone: "status-error", extraction }
    }
    if (!extraction.hasContext) {
      return { label: "No context found", tone: "status-error", extraction }
    }
    if (crmPayload?.matched) {
      return { label: "Loaded", tone: "status-ready", extraction }
    }
    return { label: "Context Found", tone: "status-ready", extraction }
  }

  function logContextStatus(status, details = {}) {
    console.log(LOG_PREFIX, {
      label: status?.label ?? null,
      tone: status?.tone ?? null,
      hasContext: status?.extraction?.hasContext ?? null,
      person: status?.extraction?.person ?? null,
      company: status?.extraction?.company ?? null,
      ...details,
    })
  }

  window.EquipifyGrowthContextNormalize = {
    LOG_PREFIX,
    normalizeExtractionPayload,
    buildResearchSnapshotLines,
    resolveContextStatusLabel,
    logContextStatus,
  }
})()
