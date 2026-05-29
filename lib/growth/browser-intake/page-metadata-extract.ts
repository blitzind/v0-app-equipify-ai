/** Visible page metadata extraction for browser intake — client-safe, no DOM hidden scraping. */

export type BrowserIntakePageMetadata = {
  page_title: string | null
  company_name: string | null
  website: string | null
  linkedin_url: string | null
  source_url: string | null
  source_platform: "linkedin" | "website" | "other"
  og_site_name: string | null
  canonical_url: string | null
}

function trimOrNull(value: unknown): string | null {
  const trimmed = typeof value === "string" ? value.trim() : ""
  return trimmed ? trimmed : null
}

export function detectBrowserIntakeSourcePlatform(url: string | null | undefined): "linkedin" | "website" | "other" {
  const raw = trimOrNull(url)
  if (!raw) return "other"
  try {
    if (new URL(raw).hostname.toLowerCase().includes("linkedin.com")) return "linkedin"
  } catch {
    // ignore
  }
  return "website"
}

export function cleanBrowserIntakePageUrl(url: string | null | undefined): string | null {
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

function readMetaContent(doc: Document, selectors: string[]): string | null {
  for (const selector of selectors) {
    const el = doc.querySelector(selector)
    const content = el?.getAttribute("content")?.trim()
    if (content) return content
  }
  return null
}

function readCanonicalUrl(doc: Document): string | null {
  const href = doc.querySelector('link[rel="canonical"]')?.getAttribute("href")?.trim()
  if (!href) return null
  try {
    return new URL(href, doc.baseURI).toString()
  } catch {
    return href
  }
}

function readJsonLdOrganizationName(doc: Document): string | null {
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]')
  for (const script of scripts) {
    const raw = script.textContent?.trim()
    if (!raw) continue
    try {
      const parsed = JSON.parse(raw) as unknown
      const names = collectOrganizationNames(parsed)
      if (names.length > 0) return names[0]!
    } catch {
      // ignore invalid JSON-LD
    }
  }
  return null
}

function collectOrganizationNames(value: unknown): string[] {
  if (!value) return []
  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectOrganizationNames(entry))
  }
  if (typeof value !== "object") return []

  const record = value as Record<string, unknown>
  const typeValue = record["@type"]
  const types = Array.isArray(typeValue) ? typeValue : typeValue ? [typeValue] : []
  const names: string[] = []

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

export function inferCompanyNameFromLinkedInTitle(title: string | null | undefined): string | null {
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

export function inferCompanyNameFromPageTitle(title: string | null | undefined): string | null {
  const raw = trimOrNull(title)
  if (!raw) return null

  const withoutSite = raw
    .replace(/\s*[|\-–—]\s*[^|\-–—]{1,40}$/u, "")
    .trim()

  return trimOrNull(withoutSite) ?? raw
}

export function websiteOriginFromUrl(url: string | null | undefined): string | null {
  const raw = trimOrNull(url)
  if (!raw) return null
  if (detectBrowserIntakeSourcePlatform(raw) === "linkedin") return null
  try {
    const parsed = new URL(raw)
    if (!/^https?:$/i.test(parsed.protocol)) return null
    return `${parsed.protocol}//${parsed.host}`
  } catch {
    return null
  }
}

/** Extract only visible document metadata — safe to run in an injected page script. */
export function extractVisiblePageMetadataFromDocument(
  doc: Document,
  locationHref: string,
): BrowserIntakePageMetadata {
  const sourceUrl = cleanBrowserIntakePageUrl(locationHref)
  const sourcePlatform = detectBrowserIntakeSourcePlatform(sourceUrl)
  const pageTitle = trimOrNull(doc.title)

  const ogSiteName = readMetaContent(doc, ['meta[property="og:site_name"]', 'meta[name="og:site_name"]'])
  const ogTitle = readMetaContent(doc, ['meta[property="og:title"]', 'meta[name="og:title"]'])
  const canonicalUrl = readCanonicalUrl(doc)
  const jsonLdCompany = readJsonLdOrganizationName(doc)

  let linkedinUrl: string | null = null
  if (sourcePlatform === "linkedin" && sourceUrl) {
    linkedinUrl = sourceUrl
  }

  const companyName =
    trimOrNull(ogSiteName) ??
    jsonLdCompany ??
    (sourcePlatform === "linkedin"
      ? inferCompanyNameFromLinkedInTitle(ogTitle ?? pageTitle)
      : inferCompanyNameFromPageTitle(ogTitle ?? pageTitle))

  const website =
    websiteOriginFromUrl(canonicalUrl) ??
    websiteOriginFromUrl(sourceUrl)

  return {
    page_title: pageTitle,
    company_name: companyName,
    website,
    linkedin_url: linkedinUrl,
    source_url: sourceUrl,
    source_platform: sourcePlatform === "linkedin" ? "linkedin" : "website",
    og_site_name: ogSiteName,
    canonical_url: canonicalUrl,
  }
}

export function mergeBrowserIntakePageMetadata(
  tabUrl: string | null | undefined,
  extracted: Partial<BrowserIntakePageMetadata> | null | undefined,
): BrowserIntakePageMetadata {
  const sourceUrl = cleanBrowserIntakePageUrl(tabUrl)
  const platform = detectBrowserIntakeSourcePlatform(sourceUrl)
  const fallbackWebsite = websiteOriginFromUrl(sourceUrl)
  const fallbackLinkedIn = platform === "linkedin" && sourceUrl ? sourceUrl : null

  return {
    page_title: trimOrNull(extracted?.page_title) ?? null,
    company_name: trimOrNull(extracted?.company_name) ?? null,
    website: trimOrNull(extracted?.website) ?? fallbackWebsite,
    linkedin_url: trimOrNull(extracted?.linkedin_url) ?? fallbackLinkedIn,
    source_url: trimOrNull(extracted?.source_url) ?? sourceUrl,
    source_platform: extracted?.source_platform ?? (platform === "linkedin" ? "linkedin" : "website"),
    og_site_name: trimOrNull(extracted?.og_site_name) ?? null,
    canonical_url: trimOrNull(extracted?.canonical_url) ?? null,
  }
}
