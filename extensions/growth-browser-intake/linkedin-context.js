/** LinkedIn page context detection — keep aligned with lib/growth/browser-intake/linkedin-context-detect.ts */

function trimOrNull(value) {
  const trimmed = typeof value === "string" ? value.trim() : ""
  return trimmed ? trimmed : null
}

function detectSourcePlatform(url) {
  const raw = trimOrNull(url)
  if (!raw) return "other"
  try {
    if (new URL(raw).hostname.toLowerCase().includes("linkedin.com")) return "linkedin"
  } catch {
    // ignore
  }
  return "website"
}

function cleanPageUrl(url) {
  const raw = trimOrNull(url)
  if (!raw) return null
  try {
    const parsed = new URL(raw)
    parsed.hash = ""
    return parsed.toString()
  } catch {
    return raw
  }
}

function detectLinkedInPageKind(url) {
  const raw = trimOrNull(url)
  if (!raw || detectSourcePlatform(raw) !== "linkedin") return null
  try {
    const path = new URL(raw).pathname.replace(/\/+$/, "")
    if (/^\/in\/[^/]+/i.test(path)) return "profile"
    if (/^\/company\/[^/]+/i.test(path)) return "company"
    return "other"
  } catch {
    return null
  }
}

function normalizeLinkedInLookupUrl(url) {
  const cleaned = cleanPageUrl(url)
  if (!cleaned || detectSourcePlatform(cleaned) !== "linkedin") return null
  try {
    const parsed = new URL(cleaned)
    const kind = detectLinkedInPageKind(cleaned)
    if (kind === "profile") {
      const match = parsed.pathname.match(/^(\/in\/[^/]+)/i)
      if (match?.[1]) return `https://www.linkedin.com${match[1]}/`
    }
    if (kind === "company") {
      const match = parsed.pathname.match(/^(\/company\/[^/]+)/i)
      if (match?.[1]) return `https://www.linkedin.com${match[1]}/`
    }
    return cleaned
  } catch {
    return cleaned
  }
}

function inferLinkedInProfileNameFromTitle(title) {
  const raw = trimOrNull(title)
  if (!raw) return null
  const withoutLinkedIn = raw.replace(/\s*[|\-–—]\s*LinkedIn\s*$/i, "").trim()
  if (!withoutLinkedIn) return null
  const firstSegment = withoutLinkedIn.split(/\s*[|\-–—]\s*/)[0]?.trim()
  if (!firstSegment) return null
  const namePart = firstSegment.split(/\s+-\s+/)[0]?.trim()
  return trimOrNull(namePart) ?? trimOrNull(firstSegment)
}

function buildLinkedInLookupQuery(input) {
  const linkedinUrl = normalizeLinkedInLookupUrl(input.linkedin_url ?? input.url)
  const pageKind = detectLinkedInPageKind(input.url ?? input.linkedin_url)
  const contactName =
    pageKind === "profile" ? inferLinkedInProfileNameFromTitle(input.page_title) : null

  return {
    linkedin_url: linkedinUrl,
    company_name: trimOrNull(input.company_name),
    website: trimOrNull(input.website),
    email: trimOrNull(input.email)?.toLowerCase() ?? null,
    linkedin_page_kind: pageKind,
    contact_name: contactName,
  }
}

window.EquipifyGrowthLinkedInContext = {
  detectLinkedInPageKind,
  normalizeLinkedInLookupUrl,
  inferLinkedInProfileNameFromTitle,
  buildLinkedInLookupQuery,
}
