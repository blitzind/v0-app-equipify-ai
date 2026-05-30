/**
 * Visible page metadata extraction for injected scripts.
 * Visible DOM / public metadata only — no hidden LinkedIn scraping or private endpoints.
 */
function trimOrNull(value) {
  const trimmed = typeof value === "string" ? value.trim() : ""
  return trimmed ? trimmed : null
}

function normalizeVisibleText(value) {
  const raw = trimOrNull(value)
  if (!raw) return null
  if (/\s/.test(raw)) return trimOrNull(raw.replace(/\s+/g, " "))
  return trimOrNull(raw.replace(/([a-z])([A-Z])/g, "$1 $2"))
}

function cleanLinkedInProfileName(value) {
  const raw = normalizeVisibleText(value)
  if (!raw) return null
  return trimOrNull(
    raw
      .replace(/\s*[·•]\s*\d+(?:st|nd|rd|th)?\+?.*$/i, "")
      .replace(/\s*[·•]\s*\d+\+?\s*$/i, "")
      .trim(),
  )
}

function parseLinkedInHeadline(headline) {
  const normalized = normalizeVisibleText(headline)
  if (!normalized) return { title: null, company: null }

  const atMatch = normalized.match(/^(.+?)\s+at\s+(.+?)(?:\s*[|·].*)?$/i)
  if (atMatch) {
    return {
      title: trimOrNull(atMatch[1]),
      company: trimOrNull(atMatch[2]?.replace(/\s*[|·]\s*(Full-time|Part-time|Self-employed|Contract|Freelance|Internship).*$/i, "")),
    }
  }

  const withoutEmployment = normalized.replace(
    /\s*[|·]\s*(Full-time|Part-time|Self-employed|Contract|Freelance|Internship).*$/i,
    "",
  )
  return { title: trimOrNull(withoutEmployment), company: null }
}

function inferLinkedInProfileNameFromTitle(title) {
  const raw = trimOrNull(title)
  if (!raw) return null
  const withoutLinkedIn = raw.replace(/\s*[|\-–—]\s*LinkedIn\s*$/i, "").trim()
  if (!withoutLinkedIn) return null
  const firstSegment = withoutLinkedIn.split(/\s*[|\-–—]\s*/)[0]?.trim()
  if (!firstSegment) return null
  const namePart = firstSegment.split(/\s+-\s+/)[0]?.trim()
  return cleanLinkedInProfileName(namePart ?? firstSegment)
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

function detectLinkedInPageKind(url) {
  const raw = trimOrNull(url)
  if (!raw) return null
  if (/\/company\//i.test(raw)) return "company"
  if (/\/in\//i.test(raw)) return "profile"
  return null
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

function queryText(doc, selectors) {
  for (const selector of selectors) {
    const el = doc.querySelector(selector)
    const text = trimOrNull(el?.textContent)
    if (text) return text
  }
  return null
}

function queryImageSrc(doc, selectors) {
  for (const selector of selectors) {
    const el = doc.querySelector(selector)
    const src =
      trimOrNull(el?.getAttribute("src")) ??
      trimOrNull(el?.getAttribute("data-delayed-url")) ??
      trimOrNull(el?.getAttribute("data-ghost-url"))
    if (src && !src.startsWith("data:")) return src
  }
  return null
}

function normalizeLinkedInCompanyUrl(href) {
  const raw = trimOrNull(href)
  if (!raw) return null
  try {
    const parsed = new URL(raw, window.location.href)
    if (!parsed.hostname.toLowerCase().includes("linkedin.com")) return null
    const match = parsed.pathname.match(/^(\/company\/[^/]+)/i)
    if (!match?.[1]) return null
    return `https://www.linkedin.com${match[1]}/`
  } catch {
    return null
  }
}

function normalizeLinkedInProfileUrl(href) {
  const raw = trimOrNull(href)
  if (!raw) return null
  try {
    const parsed = new URL(raw, window.location.href)
    if (!parsed.hostname.toLowerCase().includes("linkedin.com")) return null
    const match = parsed.pathname.match(/^(\/in\/[^/]+)/i)
    if (!match?.[1]) return null
    return `https://www.linkedin.com${match[1]}/`
  } catch {
    return null
  }
}

function parseLocationParts(location) {
  const raw = trimOrNull(location)
  if (!raw) return { city: null, state: null, location: null }
  const parts = raw.split(",").map((part) => part.trim()).filter(Boolean)
  if (parts.length >= 2) {
    return { city: parts[0], state: parts[parts.length - 1], location: raw }
  }
  return { city: null, state: parts[0] ?? null, location: raw }
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

function findExternalWebsite(doc, scope = doc) {
  const anchors = (scope ?? doc).querySelectorAll('a[href^="http"]')
  for (const anchor of anchors) {
    const href = trimOrNull(anchor.getAttribute("href"))
    if (!href) continue
    try {
      const parsed = new URL(href)
      const host = parsed.hostname.toLowerCase()
      if (host.includes("linkedin.com")) continue
      if (/facebook|twitter|x\.com|instagram|youtube|tiktok|google|lnkd\.in/.test(host)) continue
      return `${parsed.protocol}//${parsed.host}`
    } catch {
      // ignore
    }
  }
  return null
}

function extractProfileWebsite(doc) {
  const contactSection =
    doc.querySelector("#top-card-text-contact-info") ??
    doc.querySelector('[data-view-name="profile-contact-info"]') ??
    doc.querySelector('[data-view-name="contact-info"]')

  if (contactSection) {
    const fromContact = findExternalWebsite(doc, contactSection)
    if (fromContact) return fromContact
  }

  const defs = extractDefinitionMap(doc)
  const websiteLabel = defs.website ?? defs["company website"]
  if (websiteLabel) {
    const normalized = websiteLabel.startsWith("http") ? websiteLabel : `https://${websiteLabel}`
    return websiteOriginFromUrl(normalized) ?? trimOrNull(normalized)
  }

  const aboutSection =
    doc.querySelector("#about")?.closest("section") ??
    doc.querySelector('[data-view-name="profile-about"]')
  if (aboutSection) {
    const fromAbout = findExternalWebsite(doc, aboutSection)
    if (fromAbout) return fromAbout
  }

  const topCard = doc.querySelector("main section.artdeco-card") ?? doc.querySelector("main")
  return findExternalWebsite(doc, topCard ?? doc)
}

function extractProfileLocation(doc) {
  const selectors = [
    ".pv-text-details__left-panel span.text-body-small.inline",
    "span.text-body-small.inline.t-black--light.break-words",
    ".text-body-small.inline.t-black--light",
    "[data-view-name='profile-card'] span.text-body-small",
    "main span.text-body-small",
  ]

  for (const selector of selectors) {
    const nodes = doc.querySelectorAll(selector)
    for (const node of nodes) {
      const text = trimOrNull(node.textContent)
      if (!text) continue
      if (/\d[\d,]*\+?\s+(connections|followers)/i.test(text)) continue
      if (/contact info|message|follow|connect/i.test(text)) continue
      if (text.length > 120) continue
      return text
    }
  }
  return null
}

function extractAboutText(doc) {
  const section =
    doc.querySelector("#about ~ div") ??
    doc.querySelector('[data-view-name="profile-about"]') ??
    doc.querySelector(".org-about-module__description") ??
    doc.querySelector(".break-words.white-space-pre-wrap")
  const text = trimOrNull(section?.textContent)
  if (text && text.length > 20) return text.slice(0, 1200)
  return null
}

function extractDefinitionMap(doc) {
  const map = {}
  doc.querySelectorAll("dl").forEach((dl) => {
    const terms = dl.querySelectorAll("dt")
    terms.forEach((dt) => {
      const label = trimOrNull(dt.textContent)?.toLowerCase()
      const dd = dt.nextElementSibling
      const value = trimOrNull(dd?.textContent)
      if (label && value) map[label] = value
    })
  })
  return map
}

function normalizeComparisonName(value) {
  return trimOrNull(value)?.toLowerCase().replace(/\s+/g, " ") ?? ""
}

function rejectCompanyIfPersonName(companyName, personName) {
  const company = normalizeVisibleText(companyName)
  if (!company) return null
  if (personName && normalizeComparisonName(company) === normalizeComparisonName(personName)) {
    return null
  }
  return company
}

function readCompanyFromAnchor(anchor) {
  if (!anchor) return { name: null, url: null }
  return {
    name: normalizeVisibleText(trimOrNull(anchor.textContent)),
    url: normalizeLinkedInCompanyUrl(anchor.getAttribute("href")),
  }
}

function companyNameFromLinkedInCompanyUrl(url) {
  const raw = trimOrNull(url)
  if (!raw) return null
  const match = raw.match(/\/company\/([^/?#]+)/i)
  if (!match?.[1]) return null
  const slug = decodeURIComponent(match[1]).replace(/-/g, " ")
  return normalizeVisibleText(slug)
}

function findTopCardCompanyAnchor(topCard, doc) {
  const topCardRoot = topCard ?? doc
  return (
    topCardRoot.querySelector(".pv-text-details__right-panel a[href*='/company/']") ??
    topCardRoot.querySelector(".pv-text-details__left-panel a[href*='/company/']") ??
    topCardRoot.querySelector("a[href*='/company/']") ??
    doc.querySelector("[data-view-name='profile-card'] a[href*='/company/']")
  )
}

function resolveProfileCompanyExtraction(doc, topCard, personName, experienceEntries) {
  const candidates = []
  const topCompanyAnchor = findTopCardCompanyAnchor(topCard, doc)
  const topCardCompany = readCompanyFromAnchor(topCompanyAnchor)
  const currentExperience =
    experienceEntries.find((entry) => /\bpresent\b/i.test(entry.date_range ?? "")) ?? experienceEntries[0]

  if (currentExperience?.company_name) {
    candidates.push({
      name: currentExperience.company_name,
      source: "experience.current",
      url: currentExperience.linkedin_company_url ?? null,
      anchor: null,
    })
  }

  if (topCardCompany.name) {
    candidates.push({
      name: topCardCompany.name,
      source: "top-card.company-anchor",
      url: topCardCompany.url,
      anchor: topCompanyAnchor,
    })
  }

  for (const entry of experienceEntries) {
    if (!entry.company_name) continue
    candidates.push({
      name: entry.company_name,
      source: "experience.section",
      url: entry.linkedin_company_url ?? null,
      anchor: null,
    })
  }

  const urlCandidates = [
    currentExperience?.linkedin_company_url,
    topCardCompany.url,
    ...experienceEntries.map((entry) => entry.linkedin_company_url),
  ].filter(Boolean)

  for (const url of urlCandidates) {
    const fromUrl = companyNameFromLinkedInCompanyUrl(url)
    if (fromUrl) {
      candidates.push({
        name: fromUrl,
        source: "company-url.slug",
        url,
        anchor: null,
      })
    }
  }

  const candidateNames = candidates.map((candidate) => candidate.name).filter(Boolean)
  let selected = null

  for (const candidate of candidates) {
    const sanitized = rejectCompanyIfPersonName(candidate.name, personName)
    if (!sanitized) continue
    selected = {
      company_name: sanitized,
      linkedin_company_url: candidate.url ?? null,
      source_selector: candidate.source,
      anchor: candidate.anchor,
    }
    break
  }

  console.log("[Equipify Sales:company]", {
    person_name: personName ?? null,
    candidate_company_names: candidateNames,
    selected_company_name: selected?.company_name ?? null,
    source_selector: selected?.source_selector ?? null,
  })

  return selected ?? { company_name: null, linkedin_company_url: null, source_selector: null, anchor: null }
}

function extractExperienceEntries(doc) {
  const entries = []
  const seen = new Set()

  const section =
    doc.querySelector("#experience")?.closest("section") ??
    doc.querySelector('[data-view-name="profile-card-experience"]')

  if (!section) return []

  section.querySelectorAll('li, div.pvs-list__paged-list-item, [data-view-name="profile-component-entity"]').forEach((item) => {
    const companyAnchor = item.querySelector('a[href*="/company/"]')
    const companyName = normalizeVisibleText(trimOrNull(companyAnchor?.textContent))
    const companyUrl = normalizeLinkedInCompanyUrl(companyAnchor?.getAttribute("href"))
    const titleEl =
      item.querySelector(".t-bold span[aria-hidden='true']") ??
      item.querySelector(".mr1.hoverable-link-text span") ??
      item.querySelector("span[aria-hidden='true']")
    const title = normalizeVisibleText(trimOrNull(titleEl?.textContent))
    const dateText = trimOrNull(item.querySelector(".pvs-entity__caption-wrapper")?.textContent)
    const key = `${companyName ?? ""}|${title ?? ""}`
    if (!companyName && !title) return
    if (seen.has(key)) return
    seen.add(key)
    entries.push({
      company_name: companyName,
      title,
      linkedin_company_url: companyUrl,
      date_range: dateText,
    })
  })

  return entries.slice(0, 8)
}

function extractEducationEntries(doc) {
  const entries = []
  const seen = new Set()
  const section =
    doc.querySelector("#education")?.closest("section") ??
    doc.querySelector('[data-view-name="profile-card-education"]')

  const scope = section ?? doc
  scope.querySelectorAll('li, div.pvs-list__paged-list-item, [data-view-name="profile-component-entity"]').forEach((item) => {
    const schoolAnchor = item.querySelector('a[href*="/school/"], a[href*="/company/"]')
    const schoolName = trimOrNull(schoolAnchor?.textContent)
    const degree = trimOrNull(item.querySelector(".t-14.t-normal")?.textContent)
    const key = schoolName ?? ""
    if (!schoolName || seen.has(key)) return
    seen.add(key)
    entries.push({ school_name: schoolName, degree })
  })
  return entries.slice(0, 6)
}

function isPlausibleMetricText(text, pattern) {
  const raw = trimOrNull(text)
  if (!raw || raw.length > 80) return false
  if (/skip to|main content|keyboard shortcut|sign in|linkedin/i.test(raw)) return false
  return pattern.test(raw)
}

function extractScopedMetric(doc, pattern, scopes) {
  const roots = scopes.filter(Boolean)
  const seen = new Set()
  for (const root of roots) {
    for (const node of root.querySelectorAll("span, li, div")) {
      const text = trimOrNull(node.textContent)
      if (!text || seen.has(text)) continue
      seen.add(text)
      if (isPlausibleMetricText(text, pattern)) return text
    }
  }
  return null
}

function extractProfileConnectionsMetric(doc, topCard) {
  return extractScopedMetric(doc, /\d[\d,]*\+?\s+connections/i, [
    topCard,
    doc.querySelector("[data-view-name='profile-card']"),
    doc.querySelector("main section.artdeco-card"),
  ])
}

function extractCompanyFollowersMetric(doc) {
  return extractScopedMetric(doc, /\d[\d,]*\+?\s+followers/i, [
    doc.querySelector(".org-top-card"),
    doc.querySelector(".org-top-card-primary-content"),
    doc.querySelector("main section.artdeco-card"),
    doc.querySelector("[data-view-name='profile-card']"),
  ])
}

function extractCompanyEmployeeMetric(doc) {
  return extractScopedMetric(doc, /\d[\d,]*\+?\s+employees/i, [
    doc.querySelector(".org-top-card"),
    doc.querySelector(".org-top-card-summary-info-list"),
    doc.querySelector("main section.artdeco-card"),
  ]) ?? extractScopedMetric(doc, /\d[\d,–-]+\s+employees/i, [
    doc.querySelector(".org-top-card"),
    doc.querySelector(".org-top-card-summary-info-list"),
    doc.querySelector("main section.artdeco-card"),
  ])
}

function extractLinkedInProfile(doc) {
  const topCard =
    doc.querySelector("main section.artdeco-card") ??
    doc.querySelector("[data-view-name='profile-card']") ??
    doc.querySelector("main")

  const contact_name =
    cleanLinkedInProfileName(
      queryText(topCard ?? doc, [
        "h1.text-heading-xlarge",
        "main h1.text-heading-xlarge",
        "h1.text-heading-xlarge",
        "main section.artdeco-card h1",
        "main h1.break-words",
        "[data-view-name='profile-card'] h1",
        "main h1",
      ]),
    ) ?? inferLinkedInProfileNameFromTitle(doc.title)

  const headline = normalizeVisibleText(
    queryText(topCard ?? doc, [
      "div.text-body-medium.break-words",
      ".pv-text-details__left-panel .text-body-medium",
      ".ph5.pb5 .text-body-medium",
      "[data-view-name='profile-card'] .text-body-medium:not(.t-black--light)",
      ".top-card-layout__headline",
      "[data-view-name='profile-header'] .text-body-medium",
    ]),
  )

  const location = extractProfileLocation(doc)

  const profile_photo_url = queryImageSrc(doc, [
    "img.pv-top-card-profile-picture__image",
    "img.profile-photo-edit__preview",
    "button.pv-top-card-profile-picture img",
    "img.pv-top-card-profile-picture__image--show",
    "img.pv-top-card-member-photo",
    "img[data-anonymize='headshot-photo']",
    'img[alt*="profile"]',
  ])

  const headlineParts = parseLinkedInHeadline(headline)
  const experienceEntries = extractExperienceEntries(doc)
  const companySelection = resolveProfileCompanyExtraction(doc, topCard, contact_name, experienceEntries)
  const current_company = companySelection.company_name
  const currentExperience =
    experienceEntries.find((entry) => /\bpresent\b/i.test(entry.date_range ?? "")) ?? experienceEntries[0]

  let current_title = normalizeVisibleText(currentExperience?.title) ?? headlineParts.title
  if (current_title && current_company && current_title.includes(current_company)) {
    current_title = headlineParts.title ?? normalizeVisibleText(currentExperience?.title)
  }

  const linkedin_company_url = companySelection.linkedin_company_url
  const companyAnchor = companySelection.anchor ?? findTopCardCompanyAnchor(topCard, doc)
  const company_logo_url = companyAnchor
    ? trimOrNull(companyAnchor.querySelector("img")?.getAttribute("src")) ??
      trimOrNull(companyAnchor.querySelector("img")?.getAttribute("data-delayed-url"))
    : null
  const website = extractProfileWebsite(doc)

  const locationParts = parseLocationParts(location)
  const connections = extractProfileConnectionsMetric(doc, topCard)
  const followers = extractCompanyFollowersMetric(doc)

  const rawProfileExtract = {
    linkedin_page_kind: "profile",
    contact_name,
    headline,
    title: current_title,
    location: locationParts.location,
    city: locationParts.city,
    state: locationParts.state,
    profile_photo_url,
    company_name: current_company,
    website,
    linkedin_company_url,
    company_logo_url,
    company_description: extractAboutText(doc),
    connections_count: connections,
    followers_count: followers,
    experience_companies: experienceEntries,
    education_entries: extractEducationEntries(doc),
  }

  console.log("[Equipify Sales:context]", "raw_profile_extract", rawProfileExtract)

  return rawProfileExtract
}

function extractLinkedInCompany(doc) {
  const company_name =
    queryText(doc, [
      "main h1.org-top-card-summary__title",
      "h1.org-top-card-summary__title",
      "h1[class*='org-top-card']",
      ".org-top-card-primary-content__title",
      "main h1.text-heading-xlarge",
      "main h1",
    ]) ?? inferCompanyNameFromLinkedInTitle(doc.title)

  const company_logo_url = queryImageSrc(doc, [
    "img.org-top-card-primary-content__logo",
    ".org-top-card-primary-content img",
    "img.org-top-card-primary-content__logo-image",
    "img[alt*='logo']",
  ])

  const defs = extractDefinitionMap(doc)
  const industry = defs.industry ?? queryText(doc, [".org-top-card-summary-info-list__info-item"])
  const employee_count = defs["company size"] ?? extractCompanyEmployeeMetric(doc)
  const employee_range = employee_count
  const headquarters = defs.headquarters ?? defs.location
  const founded = defs.founded ?? defs["founded year"]
  const specialties = defs.specialties
  const company_type = defs.type ?? defs["company type"]
  const followers_count = extractCompanyFollowersMetric(doc)
  const locationParts = parseLocationParts(headquarters)

  const websiteLink = doc.querySelector(
    'a[href^="http"]:not([href*="linkedin.com"])',
  )
  const websiteFromLink = websiteLink?.getAttribute("href")

  const keywords = specialties
    ? specialties
        .split(",")
        .map((part) => trimOrNull(part))
        .filter(Boolean)
    : []

  const office_locations = []
  if (headquarters) office_locations.push(headquarters)
  doc.querySelectorAll(".org-locations-module__location-card, .org-location-card").forEach((node) => {
    const text = trimOrNull(node.textContent)
    if (text && !office_locations.includes(text)) office_locations.push(text)
  })

  return {
    linkedin_page_kind: "company",
    company_name,
    company_logo_url,
    linkedin_company_url: normalizeLinkedInCompanyUrl(window.location.href),
    website: trimOrNull(websiteFromLink) ?? findExternalWebsite(doc),
    company_description: extractAboutText(doc),
    industry,
    employee_count,
    employee_range,
    founded,
    company_type,
    keywords,
    followers_count,
    location: headquarters ?? locationParts.location,
    city: locationParts.city,
    state: locationParts.state,
    office_locations: office_locations.slice(0, 8),
  }
}

function extractVisiblePageMetadata() {
  const sourceUrl = cleanPageUrl(window.location.href)
  const sourcePlatform = detectSourcePlatform(sourceUrl)
  const pageTitle = trimOrNull(document.title)
  const linkedinKind = sourcePlatform === "linkedin" ? detectLinkedInPageKind(sourceUrl) : null

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
    linkedinUrl = normalizeLinkedInProfileUrl(sourceUrl) ?? sourceUrl
  }

  const linkedinExtract =
    linkedinKind === "profile"
      ? extractLinkedInProfile(document)
      : linkedinKind === "company"
        ? extractLinkedInCompany(document)
        : {}

  const fallbackCompanyName =
    linkedinKind === "profile"
      ? null
      : trimOrNull(ogSiteName) ??
        jsonLdCompany ??
        (sourcePlatform === "linkedin"
          ? inferCompanyNameFromLinkedInTitle(ogTitle ?? pageTitle)
          : inferCompanyNameFromPageTitle(ogTitle ?? pageTitle))

  const profileCompanyName =
    linkedinKind === "profile"
      ? rejectCompanyIfPersonName(linkedinExtract.company_name, linkedinExtract.contact_name)
      : rejectCompanyIfPersonName(linkedinExtract.company_name, linkedinExtract.contact_name) ??
        fallbackCompanyName

  const website =
    trimOrNull(linkedinExtract.website) ??
    websiteOriginFromUrl(canonicalUrl) ??
    websiteOriginFromUrl(sourceUrl)

  const metadata = {
    page_title: pageTitle,
    company_name: profileCompanyName,
    website,
    linkedin_url: linkedinKind === "profile" ? linkedinUrl : linkedinExtract.linkedin_company_url ?? linkedinUrl,
    linkedin_company_url: linkedinExtract.linkedin_company_url ?? null,
    source_url: sourceUrl,
    source_platform: sourcePlatform === "linkedin" ? "linkedin" : "website",
    linkedin_page_kind: linkedinKind,
    og_site_name: ogSiteName,
    canonical_url: canonicalUrl,
    profile_photo_url:
      linkedinExtract.profile_photo_url ??
      (sourcePlatform === "linkedin" && linkedinKind === "profile" ? trimOrNull(ogImage) : null),
    company_logo_url: linkedinExtract.company_logo_url ?? null,
    contact_name: linkedinExtract.contact_name ?? null,
    headline: linkedinExtract.headline ?? null,
    title:
      linkedinExtract.title ??
      parseLinkedInHeadline(linkedinExtract.headline ?? "").title ??
      null,
    headline: linkedinExtract.headline ?? null,
    location: linkedinExtract.location ?? null,
    city: linkedinExtract.city ?? null,
    state: linkedinExtract.state ?? null,
    company_description: linkedinExtract.company_description ?? null,
    industry: linkedinExtract.industry ?? null,
    employee_count: linkedinExtract.employee_count ?? null,
    employee_range: linkedinExtract.employee_range ?? null,
    founded: linkedinExtract.founded ?? null,
    company_type: linkedinExtract.company_type ?? null,
    keywords: linkedinExtract.keywords ?? [],
    followers_count: linkedinExtract.followers_count ?? null,
    connections_count: linkedinExtract.connections_count ?? null,
    office_locations: linkedinExtract.office_locations ?? [],
    experience_companies: linkedinExtract.experience_companies ?? [],
    education_entries: linkedinExtract.education_entries ?? [],
  }

  console.log("[Equipify Sales:context]", "extract_visible_metadata", {
    platform: metadata.source_platform,
    kind: metadata.linkedin_page_kind,
    contact: metadata.contact_name,
    headline: metadata.headline,
    company: metadata.company_name,
    website: metadata.website,
    location: metadata.location,
  })

  if (metadata.linkedin_page_kind === "profile") {
    console.log("[Equipify Sales:context]", "normalized_profile_payload", {
      person: {
        name: metadata.contact_name,
        title: metadata.title,
        headline: metadata.headline,
        location: metadata.location,
        linkedin_url: metadata.linkedin_url,
        profile_image_url: metadata.profile_photo_url,
      },
      company: {
        name: metadata.company_name,
        linkedin_company_url: metadata.linkedin_company_url,
        logo_url: metadata.company_logo_url,
      },
    })
  }

  return metadata
}

if (typeof window !== "undefined") {
  window.__equipifyGrowthExtract = extractVisiblePageMetadata
  window.__equipifyGrowthParseLinkedInHeadline = parseLinkedInHeadline
  window.__equipifyGrowthNormalizeVisibleText = normalizeVisibleText
  window.__equipifyGrowthRejectCompanyIfPersonName = rejectCompanyIfPersonName
  window.__equipifyGrowthResolveProfileCompanyExtraction = resolveProfileCompanyExtraction
}
