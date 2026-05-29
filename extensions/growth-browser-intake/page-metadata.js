/**
 * Visible page metadata extraction for injected scripts.
 * Keep aligned with lib/growth/browser-intake/page-metadata-extract.ts
 */
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

function readMetaContent(doc, selectors) {
  for (const selector of selectors) {
    const el = doc.querySelector(selector)
    const content = el?.getAttribute("content")?.trim()
    if (content) return content
  }
  return null
}

function readCanonicalUrl(doc) {
  const href = doc.querySelector('link[rel="canonical"]')?.getAttribute("href")?.trim()
  if (!href) return null
  try {
    return new URL(href, doc.baseURI).toString()
  } catch {
    return href
  }
}

function collectOrganizationNames(value) {
  if (!value) return []
  if (Array.isArray(value)) return value.flatMap((entry) => collectOrganizationNames(entry))
  if (typeof value !== "object") return []

  const record = value
  const typeValue = record["@type"]
  const types = Array.isArray(typeValue) ? typeValue : typeValue ? [typeValue] : []
  const names = []

  if (types.some((t) => typeof t === "string" && /organization|corporation|localbusiness|company/i.test(t))) {
    const name = trimOrNull(record.name)
    if (name) names.push(name)
  }

  if (record.organization) names.push(...collectOrganizationNames(record.organization))
  if (record.publisher) names.push(...collectOrganizationNames(record.publisher))
  if (record.mainEntity) names.push(...collectOrganizationNames(record.mainEntity))
  if (record["@graph"]) names.push(...collectOrganizationNames(record["@graph"]))

  return names
}

function readJsonLdOrganizationName(doc) {
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]')
  for (const script of scripts) {
    const raw = script.textContent?.trim()
    if (!raw) continue
    try {
      const parsed = JSON.parse(raw)
      const names = collectOrganizationNames(parsed)
      if (names.length > 0) return names[0]
    } catch {
      // ignore invalid JSON-LD
    }
  }
  return null
}

function inferCompanyNameFromLinkedInTitle(title) {
  const raw = trimOrNull(title)
  if (!raw) return null

  const withoutLinkedIn = raw.replace(/\s*[|\-–—]\s*LinkedIn\s*$/i, "").trim()
  if (!withoutLinkedIn) return null

  const companyMatch = withoutLinkedIn.match(/\bat\s+(.+)$/i)
  if (companyMatch?.[1]) return trimOrNull(companyMatch[1])

  const parts = withoutLinkedIn.split(/\s*[|\-–—]\s*/).map((part) => part.trim()).filter(Boolean)
  if (parts.length >= 2 && /linkedin/i.test(parts[parts.length - 1] ?? "")) {
    return trimOrNull(parts[parts.length - 2] ?? null)
  }

  if (parts.length === 1) return trimOrNull(parts[0] ?? null)
  return trimOrNull(parts[parts.length - 1] ?? null)
}

function inferCompanyNameFromPageTitle(title) {
  const raw = trimOrNull(title)
  if (!raw) return null
  const withoutSite = raw.replace(/\s*[|\-–—]\s*[^|\-–—]{1,40}$/u, "").trim()
  return trimOrNull(withoutSite) ?? raw
}

function websiteOriginFromUrl(url) {
  const raw = trimOrNull(url)
  if (!raw) return null
  if (detectSourcePlatform(raw) === "linkedin") return null
  try {
    const parsed = new URL(raw)
    if (!/^https?:$/i.test(parsed.protocol)) return null
    return `${parsed.protocol}//${parsed.host}`
  } catch {
    return null
  }
}

function extractVisiblePageMetadata() {
  const sourceUrl = cleanPageUrl(window.location.href)
  const sourcePlatform = detectSourcePlatform(sourceUrl)
  const pageTitle = trimOrNull(document.title)

  const ogSiteName = readMetaContent(document, [
    'meta[property="og:site_name"]',
    'meta[name="og:site_name"]',
  ])
  const ogTitle = readMetaContent(document, [
    'meta[property="og:title"]',
    'meta[name="og:title"]',
  ])
  const ogImage = readMetaContent(document, [
    'meta[property="og:image"]',
    'meta[name="og:image"]',
  ])
  const canonicalUrl = readCanonicalUrl(document)
  const jsonLdCompany = readJsonLdOrganizationName(document)

  let linkedinUrl = null
  if (sourcePlatform === "linkedin" && sourceUrl) {
    linkedinUrl = sourceUrl
  }

  const companyName =
    trimOrNull(ogSiteName) ??
    jsonLdCompany ??
    (sourcePlatform === "linkedin"
      ? inferCompanyNameFromLinkedInTitle(ogTitle ?? pageTitle)
      : inferCompanyNameFromPageTitle(ogTitle ?? pageTitle))

  const website = websiteOriginFromUrl(canonicalUrl) ?? websiteOriginFromUrl(sourceUrl)

  return {
    page_title: pageTitle,
    company_name: companyName,
    website,
    linkedin_url: linkedinUrl,
    source_url: sourceUrl,
    source_platform: sourcePlatform === "linkedin" ? "linkedin" : "website",
    og_site_name: ogSiteName,
    canonical_url: canonicalUrl,
    profile_photo_url: sourcePlatform === "linkedin" ? trimOrNull(ogImage) : null,
  }
}

if (typeof window !== "undefined") {
  window.__equipifyGrowthExtract = extractVisiblePageMetadata
}
