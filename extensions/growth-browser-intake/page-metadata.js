/**
 * Visible page metadata extraction for injected scripts.
 * Visible DOM / public metadata only — no hidden LinkedIn scraping or private endpoints.
 */
console.log("[Equipify Sales] page-metadata start")

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

const PROFILE_EXTRACTION_FORBIDDEN_SELECTORS = [
  "#activity",
  "[data-view-name='profile-activity']",
  "[data-view-name='feed-full-update']",
  "[data-view-name='feed-commentary']",
  ".feed-shared-update-v2",
  ".feed-shared-actor",
  ".feed-shared-update",
  ".update-components-actor",
  ".comments-comments-list",
  ".scaffold-layout__aside",
  "aside.scaffold-layout__aside",
  ".scaffold-layout__aside",
  ".right-rail",
  ".discovery-entity-type-card",
  "[data-view-name='people-you-may-know']",
  "[data-view-name='profile-component-discovery']",
  "#about",
  "[data-view-name='profile-about']",
  "#education",
  "[data-view-name='profile-card-education']",
]

function isInsideForbiddenProfileRegion(el) {
  if (!el || !(el instanceof Element)) return true
  let node = el
  while (node && node !== document.documentElement) {
    if (!(node instanceof Element)) break
    for (const selector of PROFILE_EXTRACTION_FORBIDDEN_SELECTORS) {
      if (node.matches?.(selector)) return true
    }
    node = node.parentElement
  }
  return false
}

function queryTextInContainer(container, selectors) {
  if (!container) return null
  for (const selector of selectors) {
    for (const el of container.querySelectorAll(selector)) {
      if (isInsideForbiddenProfileRegion(el)) continue
      const text = trimOrNull(el.textContent)
      if (text) return text
    }
  }
  return null
}

function describeElementForAudit(el) {
  if (!el || !(el instanceof Element)) return null
  const parts = [el.tagName.toLowerCase()]
  if (el.id) parts.push(`#${el.id}`)
  const viewName = el.getAttribute("data-view-name")
  if (viewName) parts.push(`[data-view-name="${viewName}"]`)
  const classes = [...(el.classList ?? [])].slice(0, 3)
  if (classes.length) parts.push(`.${classes.join(".")}`)
  return parts.join("")
}

function describeElementChain(el, maxDepth = 8) {
  const chain = []
  let node = el
  for (let depth = 0; depth < maxDepth && node instanceof Element; depth += 1) {
    chain.push(describeElementForAudit(node))
    node = node.parentElement
  }
  return chain
}

function elementHeadingText(el) {
  if (!el) return null
  const direct = [...el.childNodes]
    .filter((node) => node.nodeType === 3)
    .map((node) => trimOrNull(node.textContent))
    .filter(Boolean)
    .join(" ")
  if (direct) return trimOrNull(direct)
  const text = trimOrNull(el.textContent)
  if (!text || text.length > 60) return null
  return text
}

function findExactHeadingLeaf(doc, headingText) {
  const target = headingText.trim().toLowerCase()
  for (const el of doc.querySelectorAll("h1, h2, h3, h4, h5, h6, span, p, button, a")) {
    if (isInsideForbiddenProfileRegion(el)) continue
    if (el.closest("aside, #activity, .feed-shared-update-v2")) continue
    const aria = trimOrNull(el.getAttribute("aria-label"))
    const label = elementHeadingText(el) ?? aria
    if (label?.toLowerCase() !== target) continue
    return el
  }
  return null
}

function findSectionHeadingElement(doc, headingText) {
  const exact = findExactHeadingLeaf(doc, headingText)
  if (exact) return exact

  const target = headingText.trim().toLowerCase()
  for (const el of doc.querySelectorAll("h1, h2, h3, h4, span, div, p, button")) {
    if (isInsideForbiddenProfileRegion(el)) continue
    if (el.closest("aside, #activity, .feed-shared-update-v2")) continue
    const label = elementHeadingText(el)
    if (!label || label.toLowerCase() !== target) continue
    return el
  }
  return null
}

function isExperienceContainerValid(container) {
  if (!container || isInsideForbiddenProfileRegion(container)) return false
  return (
    Boolean(container.querySelector('li, [role="listitem"], a[href*="/company/"]')) ||
    (/\bpresent\b/i.test(container.textContent ?? "") &&
      /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d{4})/i.test(container.textContent ?? ""))
  )
}

function findMeaningfulSectionContainer(headingEl) {
  if (!headingEl) return null
  let node = headingEl.parentElement
  for (let depth = 0; depth < 10 && node; depth += 1) {
    if (isInsideForbiddenProfileRegion(node)) break
    const tag = node.tagName?.toLowerCase()
    const hasRows =
      Boolean(node.querySelector('li, [role="listitem"], a[href*="/company/"]')) ||
      (/\bpresent\b/i.test(node.textContent ?? "") &&
        /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d{4})/i.test(node.textContent ?? ""))
    if (hasRows && ["section", "article", "div", "main"].includes(tag ?? "")) return node
    node = node.parentElement
  }
  return headingEl.closest("section, div, article") ?? headingEl.parentElement
}

function findProfileNameNode(doc) {
  const candidates = []
  for (const h1 of doc.querySelectorAll("main h1, [role='main'] h1, h1")) {
    if (isInsideForbiddenProfileRegion(h1)) continue
    if (h1.closest("aside, #activity, .feed-shared-update-v2")) continue
    const text = cleanLinkedInProfileName(h1.textContent)
    if (!text || text.length > 80) continue
    candidates.push({ el: h1, inMain: Boolean(h1.closest("main, [role='main']")) })
  }
  const inMain = candidates.find((entry) => entry.inMain)
  return inMain?.el ?? candidates[0]?.el ?? null
}

function findHeadlineNearName(nameNode) {
  if (!nameNode) return null
  let sibling = nameNode.nextElementSibling
  for (let depth = 0; depth < 6 && sibling; depth += 1) {
    const text = normalizeVisibleText(sibling.textContent)
    if (text && text.length >= 8 && text.length <= 400) return sibling
    sibling = sibling.nextElementSibling
  }

  const parent = nameNode.parentElement
  if (!parent) return null
  for (const el of parent.querySelectorAll("div, span, p")) {
    if (el === nameNode || el.contains(nameNode)) continue
    if (isInsideForbiddenProfileRegion(el)) continue
    const text = normalizeVisibleText(el.textContent)
    if (!text || text.length < 8 || text.length > 400) continue
    if (/contact info|message|follow|connect/i.test(text)) continue
    return el
  }
  return null
}

function findLocationNearName(nameNode, container) {
  const scopes = [container, nameNode?.parentElement, nameNode?.closest("main, [role='main'], div")].filter(Boolean)
  for (const scope of scopes) {
    for (const node of scope.querySelectorAll("span, div, p")) {
      if (isInsideForbiddenProfileRegion(node)) continue
      if (node.contains(nameNode) && node !== nameNode.parentElement) continue
      const text = trimOrNull(node.textContent)
      if (!text || text.length > 120) continue
      if (!/,/.test(text)) continue
      if (/\d[\d,]*\+?\s+(connections|followers)/i.test(text)) continue
      if (/contact info|message|follow|connect/i.test(text)) continue
      return text
    }
  }
  return null
}

function scoreTopCardCandidate(container, nameNode) {
  if (!container?.contains?.(nameNode)) return 0
  let score = 0
  if (container.querySelector("img")) score += 1
  if (findHeadlineNearName(nameNode)) score += 1
  if (extractProfileLocation(container) || findLocationNearName(nameNode, container)) score += 1
  if (container.querySelector('a[href*="/company/"], a[href*="/school/"]')) score += 1
  const textLen = (container.textContent ?? "").length
  if (textLen > 8000) score -= 2
  if (textLen > 15000) score -= 3
  return score
}

function findProfileTopCardLegacy(doc) {
  const candidates = [
    ...doc.querySelectorAll("main section.artdeco-card"),
    ...doc.querySelectorAll("[data-view-name='profile-card']"),
  ]
  for (const section of candidates) {
    if (isInsideForbiddenProfileRegion(section)) continue
    if (section.closest("#activity, #education, #about, aside")) continue
    if (!section.querySelector("h1.text-heading-xlarge, h1.break-words, h1")) continue
    return section
  }
  return null
}

function discoverProfileTopCard(doc) {
  const nameNode = findProfileNameNode(doc)
  if (!nameNode) return { topCard: null, nameNode: null }

  let node = nameNode
  let best = null
  let bestScore = 0
  for (let depth = 0; depth < 15 && node; depth += 1) {
    if (node === doc.body || node === doc.documentElement) break
    if (isInsideForbiddenProfileRegion(node)) {
      node = node.parentElement
      continue
    }
    const score = scoreTopCardCandidate(node, nameNode)
    if (score > bestScore) {
      bestScore = score
      best = node
    }
    node = node.parentElement
  }

  const topCard =
    bestScore >= 2
      ? best
      : nameNode.closest("main > div, main > section, [role='main'] > div, [role='main'] > section") ??
        nameNode.parentElement ??
        nameNode

  return { topCard, nameNode }
}

function findProfileTopCard(doc) {
  const legacy = findProfileTopCardLegacy(doc)
  if (legacy) return legacy
  return discoverProfileTopCard(doc).topCard
}

function findExperienceSectionLegacy(doc) {
  const section =
    doc.querySelector("#experience")?.closest("section") ??
    doc.querySelector('[data-view-name="profile-card-experience"]')
  if (!section || isInsideForbiddenProfileRegion(section)) return null
  return section
}

function findExperienceSection(doc) {
  const legacy = findExperienceSectionLegacy(doc)
  if (legacy && isExperienceContainerValid(legacy)) return legacy

  const experienceId = doc.querySelector("#experience")
  if (experienceId && !isInsideForbiddenProfileRegion(experienceId)) {
    const container =
      experienceId.closest("section, article, div") ??
      findMeaningfulSectionContainer(experienceId) ??
      experienceId.parentElement
    if (container && isExperienceContainerValid(container)) return container
  }

  const heading = findSectionHeadingElement(doc, "Experience")
  if (heading) {
    const container = findMeaningfulSectionContainer(heading)
    if (container && isExperienceContainerValid(container)) return container
  }

  return null
}

function findProfileHeroContainer(nameNode, topCard) {
  const roots = [nameNode, topCard, nameNode?.parentElement].filter(Boolean)
  for (const root of roots) {
    let node = root instanceof Element ? root : null
    for (let depth = 0; depth < 14 && node; depth += 1) {
      if (isInsideForbiddenProfileRegion(node)) {
        node = node.parentElement
        continue
      }
      if (nameNode && node.contains(nameNode) && node.querySelector("img")) return node
      node = node.parentElement
    }
  }
  return topCard ?? nameNode?.closest("div, section, main") ?? null
}

function parseConcatenatedHeadlineTitleCompany(text) {
  const raw = normalizeVisibleText(text)
  if (!raw) return { title: null, company: null }
  const match = raw.match(/^(.+?[a-z0-9)\]])\s*([A-Z][A-Z][\w\s&.,'/-]+)$/)
  if (!match) return { title: raw, company: null }
  return {
    title: trimOrNull(match[1]),
    company: trimOrNull(match[2]),
  }
}

function collectEntityLinePlainTextCompanies(topCard) {
  const names = []
  if (!topCard) return names
  for (const el of topCard.querySelectorAll("div, span, p, li")) {
    const text = trimOrNull(el.textContent)
    if (!text || !text.includes("·")) continue
    for (const part of text.split("·")) {
      const name = normalizeVisibleText(part)
      if (name && name.length >= 3 && name.length <= 120) names.push(name)
    }
  }
  return [...new Set(names)]
}

function collectRawCompanyCandidates(doc, topCard, experienceSection, headline, personName) {
  const raw = []
  const scopes = [
    { scope: topCard, source: "top-card-company-anchor" },
    { scope: experienceSection, source: "experience-company-anchor" },
  ]
  for (const { scope, source } of scopes) {
    if (!scope) continue
    for (const anchor of scope.querySelectorAll('a[href*="/company/"]')) {
      raw.push({
        name: normalizeVisibleText(anchor.textContent),
        href: trimOrNull(anchor.getAttribute("href")),
        source,
        forbidden: isInsideForbiddenProfileRegion(anchor),
        is_person_name:
          Boolean(personName) &&
          normalizeComparisonName(anchor.textContent) === normalizeComparisonName(personName),
      })
    }
  }
  const parsedHeadline = parseConcatenatedHeadlineTitleCompany(headline)
  if (parsedHeadline.company) {
    raw.push({
      name: parsedHeadline.company,
      href: null,
      source: "headline-concatenated-parse",
      forbidden: false,
      is_person_name: false,
    })
  }
  for (const name of collectEntityLinePlainTextCompanies(topCard)) {
    raw.push({
      name,
      href: null,
      source: "entity-line-plain-text",
      forbidden: false,
      is_person_name: Boolean(personName) && normalizeComparisonName(name) === normalizeComparisonName(personName),
    })
  }
  return raw.filter((entry) => entry.name)
}

function discoverMainContentContainer(doc, topCard) {
  if (!topCard || !(topCard instanceof Element)) return null

  const viewportWidth = doc.defaultView?.innerWidth ?? window.innerWidth ?? 1280
  const minColumnWidth = Math.floor(viewportWidth * 0.45)
  let node = topCard
  let best = null
  let bestWidth = 0

  for (let depth = 0; depth < 15 && node; depth += 1) {
    if (node === doc.documentElement) break
    if (isInsideForbiddenProfileRegion(node)) {
      node = node.parentElement
      continue
    }

    const width = node instanceof HTMLElement ? node.offsetWidth : 0
    const isMainLike =
      node.matches?.(
        "main, [role='main'], #main-content, .application-outlet, .scaffold-layout__main, .scaffold-layout__inner",
      ) ?? false

    if (isMainLike && width >= minColumnWidth) return node
    if (width >= minColumnWidth && width > bestWidth) {
      best = node
      bestWidth = width
    }
    node = node.parentElement
  }

  return best ?? topCard.closest("main, [role='main']") ?? topCard.parentElement
}

function isSchoolEntityAnchor(anchor) {
  const href = trimOrNull(anchor?.getAttribute("href"))
  return Boolean(href && /\/school\//i.test(href))
}

function parseTopCardEntityAnchors(topCard) {
  if (!topCard) return []
  const entities = []
  for (const anchor of topCard.querySelectorAll('a[href*="/company/"], a[href*="/school/"]')) {
    if (isInsideForbiddenProfileRegion(anchor)) continue
    const { name, url } = readCompanyFromAnchor(anchor)
    if (!name) continue
    entities.push({
      name,
      url,
      anchor,
      is_school: isSchoolEntityAnchor(anchor),
    })
  }
  return entities
}

function logDomMap(context) {
  console.log("[Equipify Sales:dom-map]", {
    profile_name_node: describeElementForAudit(context.nameNode),
    profile_name_parent_chain: describeElementChain(context.nameNode),
    experience_heading: describeElementForAudit(context.experienceHeading),
    experience_heading_parent_chain: describeElementChain(context.experienceHeading),
    selected_top_card: describeElementForAudit(context.topCard),
    selected_experience_container: describeElementForAudit(context.experienceSection),
    selected_main_content_container: describeElementForAudit(context.mainContentContainer),
  })
}

function trimHtmlSnapshot(el, maxLen = 5000) {
  if (!el) return null
  const html = el.outerHTML ?? ""
  if (html.length <= maxLen) return html
  return `${html.slice(0, maxLen)}…[truncated ${html.length - maxLen} chars]`
}

function auditTopCardDiscovery(doc, topCard, nameNode) {
  const attempted = []
  for (const section of [
    ...doc.querySelectorAll("main section.artdeco-card"),
    ...doc.querySelectorAll("[data-view-name='profile-card']"),
  ]) {
    attempted.push({
      selector: describeElementForAudit(section),
      rejected: isInsideForbiddenProfileRegion(section)
        ? "forbidden-region"
        : section.closest("#activity, #education, #about, aside")
          ? "non-top-card-section"
          : !section.querySelector("h1.text-heading-xlarge, h1.break-words, h1")
            ? "missing-h1"
            : null,
    })
  }
  return {
    found: Boolean(topCard),
    selector: describeElementForAudit(topCard),
    discovery_name_node: describeElementForAudit(nameNode),
    text_preview: trimOrNull(topCard?.textContent)?.replace(/\s+/g, " ").slice(0, 200) ?? null,
    attempted_candidates: attempted.slice(0, 10),
  }
}

function auditExperienceDiscovery(doc, experienceSection) {
  const heading = findSectionHeadingElement(doc, "Experience")
  return {
    found: Boolean(experienceSection),
    selector: describeElementForAudit(experienceSection),
    experience_id_present: Boolean(doc.querySelector("#experience")),
    experience_view_present: Boolean(doc.querySelector('[data-view-name="profile-card-experience"]')),
    experience_heading: describeElementForAudit(heading),
    text_preview: trimOrNull(experienceSection?.textContent)?.replace(/\s+/g, " ").slice(0, 200) ?? null,
  }
}

function findCompanyBlockForSnapshot(doc, topCard) {
  return (
    topCard?.querySelector(".pv-text-details__right-panel") ??
    topCard?.querySelector(".pv-top-card--experience-list-item") ??
    topCard?.querySelector('a[href*="/company/"], a[href*="/school/"]')?.closest("div, span, p, li") ??
    doc.querySelector(".pv-text-details__right-panel") ??
    doc.querySelector("[data-view-name='profile-top-card']")
  )
}

function logDomSnapshot(doc, topCard, experienceSection) {
  const companyBlock = findCompanyBlockForSnapshot(doc, topCard)
  console.log("[Equipify Sales:dom-snapshot]", {
    top_card_html: trimHtmlSnapshot(topCard),
    experience_html: trimHtmlSnapshot(experienceSection),
    company_block_html: trimHtmlSnapshot(companyBlock),
  })
}

function logExtractionAudit(payload) {
  console.log("[Equipify Sales:extraction-audit]", payload)
}

function logHeroDiscovery(topCard) {
  console.log("[Equipify Sales:hero-discovery]", {
    selected_container: describeElementForAudit(topCard),
    visible_text_preview: trimOrNull(topCard?.textContent)?.replace(/\s+/g, " ").slice(0, 300) ?? null,
  })
}

function logCompanySelection(extractionAudit, companySelection) {
  console.log("[Equipify Sales:company-selection]", {
    company_candidates: extractionAudit.company_candidates ?? [],
    selected_company: companySelection.company_name ?? null,
    source: companySelection.source_selector ?? null,
  })
}

function logExperienceDiscovery(audit) {
  console.log("[Equipify Sales:experience-discovery]", audit)
}

function logProfileImageAudit(payload) {
  console.log("[Equipify Sales:profile-image]", payload)
}

function logDomAudit(payload) {
  console.log("[Equipify Sales:dom-audit]", payload)
}

function buildDomAudit(doc, context) {
  const {
    nameNode,
    topCard,
    experienceSection,
    experienceHeading,
    profilePhotoUrl,
    headline,
    personName,
  } = context

  const h1s = []
  for (const h1 of doc.querySelectorAll("h1")) {
    h1s.push({
      text: trimOrNull(h1.textContent)?.replace(/\s+/g, " ").slice(0, 120) ?? null,
      selector: describeElementForAudit(h1),
      forbidden: isInsideForbiddenProfileRegion(h1),
      parent_chain: describeElementChain(h1),
    })
  }

  const heroContainer = findProfileHeroContainer(nameNode, topCard)
  const profileImagesSeen = new Set()
  const profile_images = []
  for (const scope of [heroContainer, topCard, nameNode?.parentElement].filter(Boolean)) {
    for (const img of scope.querySelectorAll("img")) {
      const src = readProfileImageSrc(img)
      const key = src ?? describeElementForAudit(img)
      if (profileImagesSeen.has(key)) continue
      profileImagesSeen.add(key)
      const dims = readProfileImageDimensions(img)
      profile_images.push({
        src,
        alt: trimOrNull(img.getAttribute("alt")),
        width: dims.width,
        height: dims.height,
        rect: readProfileImageRect(img),
        source_selector: describeElementForAudit(img),
        forbidden: isProfileImageForbidden(img),
        cover_or_banner: isCoverOrBannerProfileImage(img, dims.width, dims.height),
        in_top_card: topCard?.contains(img) ?? false,
        in_hero_container: heroContainer?.contains(img) ?? false,
      })
    }
  }

  const experience_headings = []
  for (const keyword of ["Experience", "Education", "Activity"]) {
    for (const el of doc.querySelectorAll("h1, h2, h3, h4, h5, h6, span, div, p, button, a")) {
      const textPreview = trimOrNull(el.textContent)?.replace(/\s+/g, " ").slice(0, 120)
      if (!textPreview || !new RegExp(`\\b${keyword}\\b`, "i").test(textPreview)) continue
      experience_headings.push({
        keyword,
        selector: describeElementForAudit(el),
        label: elementHeadingText(el),
        aria_label: trimOrNull(el.getAttribute("aria-label")),
        text_preview: textPreview,
        forbidden: isInsideForbiddenProfileRegion(el),
        parent_chain: describeElementChain(el),
      })
    }
  }

  const experience_container_nodes = []
  if (experienceSection) {
    for (const node of experienceSection.querySelectorAll("a, span, div, li, p")) {
      if (experience_container_nodes.length >= 10) break
      const text = trimOrNull(node.textContent)?.replace(/\s+/g, " ").slice(0, 120)
      if (!text || text.length < 2) continue
      experience_container_nodes.push({
        tag: node.tagName.toLowerCase(),
        text,
        selector: describeElementForAudit(node),
        href: trimOrNull(node.getAttribute?.("href")),
      })
    }
  }

  return {
    h1s,
    selected_h1_parent_chain: describeElementChain(nameNode),
    experience_headings: experience_headings.slice(0, 40),
    experience_heading_parent_chain: describeElementChain(experienceHeading ?? experienceSection),
    profile_images,
    hero_container: describeElementForAudit(heroContainer),
    top_card: describeElementForAudit(topCard),
    experience_container_html_preview: trimHtmlSnapshot(experienceSection, 2000),
    experience_container_nodes,
    company_candidates_raw: collectRawCompanyCandidates(
      doc,
      topCard,
      experienceSection,
      headline,
      personName,
    ),
    selected_profile_image: profilePhotoUrl ?? null,
    experience_section_found: Boolean(experienceSection),
  }
}

function buildExperienceDiscoveryAudit(doc, experienceSection, experienceHeading) {
  const target = "experience"
  const headingCandidates = []

  for (const el of doc.querySelectorAll("h1, h2, h3, h4, span, div, p, button, a")) {
    const textPreview = trimOrNull(el.textContent)?.replace(/\s+/g, " ").slice(0, 120)
    const ariaLabel = trimOrNull(el.getAttribute?.("aria-label"))
    const mentionsExperience =
      /experience/i.test(textPreview ?? "") || /experience/i.test(ariaLabel ?? "")
    if (!mentionsExperience) continue

    const label = elementHeadingText(el) ?? trimOrNull(ariaLabel)
    let reject_reason = null
    if (isInsideForbiddenProfileRegion(el)) reject_reason = "forbidden-region"
    else if (el.closest("aside, #activity, .feed-shared-update-v2")) reject_reason = "aside-or-activity"
    else if (!label) reject_reason = "heading-text-unreadable"
    else if (label.toLowerCase() !== target) reject_reason = `heading-text-mismatch:${label}`

    let resolved_container = null
    let container_reject = null
    if (!reject_reason) {
      resolved_container = findMeaningfulSectionContainer(el)
      if (!resolved_container) container_reject = "no-container"
      else if (isInsideForbiddenProfileRegion(resolved_container)) container_reject = "container-forbidden"
      else {
        const hasRows =
          Boolean(resolved_container.querySelector('li, [role="listitem"], a[href*="/company/"]')) ||
          (/\bpresent\b/i.test(resolved_container.textContent ?? "") &&
            /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d{4})/i.test(
              resolved_container.textContent ?? "",
            ))
        if (!hasRows) container_reject = "container-missing-rows"
      }
    }

    headingCandidates.push({
      selector: describeElementForAudit(el),
      label,
      aria_label: ariaLabel,
      text_preview: textPreview,
      exact_match: label?.toLowerCase() === target,
      reject_reason: reject_reason ?? container_reject,
      resolved_container: describeElementForAudit(resolved_container),
    })
  }

  const rowCount = experienceSection ? collectExperienceRowCandidates(experienceSection).length : 0

  return {
    experience_heading_candidates: headingCandidates.slice(0, 25),
    selected_heading: describeElementForAudit(experienceHeading),
    selected_container: describeElementForAudit(experienceSection),
    parent_chain: describeElementChain(experienceSection ?? experienceHeading),
    visible_text_preview:
      trimOrNull(experienceSection?.textContent)?.replace(/\s+/g, " ").slice(0, 300) ?? null,
    row_count: rowCount,
    experience_id_present: Boolean(doc.querySelector("#experience")),
    experience_view_present: Boolean(doc.querySelector('[data-view-name="profile-card-experience"]')),
    experience_anchor_only: Boolean(
      doc.querySelector("#experience") &&
        !trimOrNull(doc.querySelector("#experience")?.textContent)?.replace(/\s+/g, " "),
    ),
  }
}

function isProfileImageForbidden(img) {
  if (isInsideForbiddenProfileRegion(img)) return true
  if (img.closest("nav, header, aside, #activity, .feed-shared-update-v2, #education, .scaffold-layout__aside"))
    return true
  if (img.closest('a[href*="/company/"], a[href*="/school/"]')) return true
  return false
}

function readProfileImageSrc(img) {
  const srcset = trimOrNull(img.getAttribute("srcset"))
  const srcsetUrl = srcset
    ?.split(",")
    .map((part) => part.trim().split(/\s+/)[0])
    .find(Boolean)
  const currentSrc =
    typeof img.currentSrc === "string" && trimOrNull(img.currentSrc) ? trimOrNull(img.currentSrc) : null
  return (
    currentSrc ??
    trimOrNull(img.getAttribute("src")) ??
    srcsetUrl ??
    trimOrNull(img.getAttribute("data-delayed-url")) ??
    trimOrNull(img.getAttribute("data-ghost-url"))
  )
}

function readProfileImageDimensions(img) {
  const width = Math.round(
    Number(img.getAttribute("width") ?? 0) || (img instanceof HTMLElement ? img.offsetWidth : 0) || 0,
  )
  const height = Math.round(
    Number(img.getAttribute("height") ?? 0) || (img instanceof HTMLElement ? img.offsetHeight : 0) || 0,
  )
  return { width, height }
}

function readProfileImageRect(img) {
  if (!(img instanceof HTMLElement) || typeof img.getBoundingClientRect !== "function") {
    return null
  }
  const rect = img.getBoundingClientRect()
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  }
}

function isCoverOrBannerProfileImage(img, width, height) {
  if (width > 0 && height > 0) {
    const ratio = width / height
    if (ratio > 2.2 || ratio < 0.35) return true
    if (width >= 400 && height <= 180) return true
  }
  const classHint = `${img.className ?? ""} ${img.closest("[class]")?.className ?? ""}`.toLowerCase()
  return /cover|background|banner|hero-background|profile-background|top-card-background/.test(classHint)
}

function scoreProfileImageCandidate(img, nameNode, topCard) {
  let score = 0
  if (topCard?.contains(img)) score += 4
  if (nameNode?.parentElement?.contains(img)) score += 2
  if (
    img.matches?.(
      ".pv-top-card-profile-picture__image, .profile-photo-edit__preview, img[data-anonymize='headshot-photo'], .pv-top-card-member-photo",
    )
  ) {
    score += 6
  }
  const { width, height } = readProfileImageDimensions(img)
  if (width >= 80 && height >= 80) score += 3
  if (width > 0 && height > 0) {
    const ratio = width / height
    if (ratio >= 0.75 && ratio <= 1.33) score += 4
    else if (ratio > 2.2 || ratio < 0.35) score -= 6
  }
  if (nameNode && img.compareDocumentPosition?.(nameNode) & 4) score += 1
  return score
}

function findProfilePhotoUrl(doc, topCard, nameNode) {
  const candidates = []
  const heroContainer = findProfileHeroContainer(nameNode, topCard)
  const scopes = []
  if (heroContainer) scopes.push({ scope: heroContainer, source: "hero-container" })
  if (topCard && topCard !== heroContainer) scopes.push({ scope: topCard, source: "top-card" })
  if (nameNode?.parentElement) scopes.push({ scope: nameNode.parentElement, source: "name-parent" })

  let selectedSrc = null
  let selectedEntry = null
  let bestScore = Number.NEGATIVE_INFINITY

  for (const { scope, source } of scopes) {
    for (const img of scope.querySelectorAll("img")) {
      const src = readProfileImageSrc(img)
      const alt = trimOrNull(img.getAttribute("alt"))
      const { width, height } = readProfileImageDimensions(img)
      const rect = readProfileImageRect(img)
      const effectiveWidth = width || rect?.width || 0
      const effectiveHeight = height || rect?.height || 0
      const entry = {
        src,
        alt,
        width: effectiveWidth,
        height: effectiveHeight,
        rect,
        source_selector: `${source}.${describeElementForAudit(img)}`,
        accepted: false,
        reject_reason: null,
        score: 0,
      }

      if (!src || src.startsWith("data:")) {
        entry.reject_reason = "missing-src"
        candidates.push(entry)
        continue
      }
      if (isProfileImageForbidden(img)) {
        entry.reject_reason = "forbidden-region"
        candidates.push(entry)
        continue
      }
      if (isCoverOrBannerProfileImage(img, effectiveWidth, effectiveHeight)) {
        entry.reject_reason = "cover-or-banner"
        candidates.push(entry)
        continue
      }
      if (
        effectiveWidth > 0 &&
        effectiveHeight > 0 &&
        (effectiveWidth < 80 || effectiveHeight < 80)
      ) {
        entry.reject_reason = "too-small"
        candidates.push(entry)
        continue
      }

      const score = scoreProfileImageCandidate(img, nameNode, heroContainer ?? topCard)
      entry.score = score
      candidates.push(entry)
      if (score > bestScore) {
        bestScore = score
        selectedSrc = src
        selectedEntry = entry
      }
    }
  }

  if (selectedEntry) selectedEntry.accepted = true

  if (!selectedSrc) {
    selectedSrc = queryImageSrc(doc, [
      "img.pv-top-card-profile-picture__image",
      "img.profile-photo-edit__preview",
      "button.pv-top-card-profile-picture img",
      "img.pv-top-card-profile-picture__image--show",
      "img.pv-top-card-member-photo",
      "img[data-anonymize='headshot-photo']",
    ])
    if (selectedSrc) {
      candidates.push({
        src: selectedSrc,
        alt: null,
        width: null,
        height: null,
        rect: null,
        source_selector: "legacy-selector-fallback",
        accepted: true,
        reject_reason: null,
        score: 0,
      })
    }
  }

  logProfileImageAudit({
    candidates,
    selected_src: selectedSrc,
  })

  return selectedSrc
}

function findCompanyAnchorsInContainer(container) {
  if (!container) return []
  const anchors = []
  for (const anchor of container.querySelectorAll("a[href*='/company/']")) {
    if (isInsideForbiddenProfileRegion(anchor)) continue
    anchors.push(anchor)
  }
  return anchors
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

function extractProfileLocation(topCard) {
  if (!topCard) return null
  const selectors = [
    ".pv-text-details__left-panel span.text-body-small.inline",
    "span.text-body-small.inline.t-black--light.break-words",
    ".text-body-small.inline.t-black--light",
    "span.text-body-small.inline",
  ]

  for (const selector of selectors) {
    for (const node of topCard.querySelectorAll(selector)) {
      if (isInsideForbiddenProfileRegion(node)) continue
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

function findTopCardCompanyAnchor(topCard) {
  if (!topCard) return null
  const selectors = [
    ".pv-text-details__right-panel a[href*='/company/']",
    ".pv-text-details__left-panel a[href*='/company/']",
    "a[href*='/company/']:not([href*='/school/'])",
  ]
  for (const selector of selectors) {
    for (const anchor of topCard.querySelectorAll(selector)) {
      if (isInsideForbiddenProfileRegion(anchor)) continue
      if (isSchoolEntityAnchor(anchor)) continue
      return anchor
    }
  }
  return null
}

function pushCompanyCandidate(candidates, input) {
  const rawValue = trimOrNull(input.raw_value ?? input.name)
  const name = normalizeVisibleText(input.name ?? rawValue)
  if (!name) return
  candidates.push({
    name,
    source_container: input.source_container,
    source_selector: input.source_selector,
    raw_value: rawValue ?? name,
    url: input.url ?? null,
    anchor: input.anchor ?? null,
  })
}

function resolveProfileCompanyExtraction(
  topCard,
  _experienceSection,
  personName,
  experienceEntries,
  auditBag,
  headlineText,
) {
  const candidates = []
  const company_candidates = []
  const topCompanyAnchor = findTopCardCompanyAnchor(topCard)
  const topCardCompany = readCompanyFromAnchor(topCompanyAnchor)
  const topCardEntities = parseTopCardEntityAnchors(topCard)
  const currentExperience =
    experienceEntries.find((entry) => /\bpresent\b/i.test(entry.date_range ?? "")) ?? experienceEntries[0]
  const currentExperienceCompany = trimOrNull(currentExperience?.company_name)
  const parsedHeadline = parseConcatenatedHeadlineTitleCompany(headlineText)

  if (currentExperience?.company_name) {
    pushCompanyCandidate(candidates, {
      name: currentExperience.company_name,
      source_container: "experience",
      source_selector: "experience.current.company",
      raw_value: currentExperience.company_name,
      url: currentExperience.linkedin_company_url ?? null,
      anchor: null,
    })
  }

  for (const entity of topCardEntities) {
    if (entity.is_school && currentExperienceCompany) continue
    pushCompanyCandidate(candidates, {
      name: entity.name,
      source_container: "top-card",
      source_selector: entity.is_school ? "top-card.school-anchor" : "top-card.entity-anchor",
      raw_value: entity.name,
      url: entity.url ?? null,
      anchor: entity.anchor,
    })
  }

  if (parsedHeadline.company) {
    pushCompanyCandidate(candidates, {
      name: parsedHeadline.company,
      source_container: "top-card",
      source_selector: "top-card.headline-plain-text",
      raw_value: parsedHeadline.company,
      url: null,
      anchor: null,
    })
  }

  for (const entityName of collectEntityLinePlainTextCompanies(topCard)) {
    if (currentExperienceCompany && /college|university|school/i.test(entityName)) continue
    pushCompanyCandidate(candidates, {
      name: entityName,
      source_container: "top-card",
      source_selector: "top-card.entity-line-plain-text",
      raw_value: entityName,
      url: null,
      anchor: null,
    })
  }

  if (topCardCompany.name) {
    pushCompanyCandidate(candidates, {
      name: topCardCompany.name,
      source_container: "top-card",
      source_selector: "top-card.company-anchor",
      raw_value: trimOrNull(topCompanyAnchor?.textContent),
      url: topCardCompany.url,
      anchor: topCompanyAnchor,
    })
  } else if (topCompanyAnchor) {
    const slug = companyNameFromLinkedInCompanyUrl(topCardCompany.url ?? topCompanyAnchor.getAttribute("href"))
    if (slug) {
      pushCompanyCandidate(candidates, {
        name: slug,
        source_container: "top-card",
        source_selector: "top-card.company-url.slug",
        raw_value: slug,
        url: normalizeLinkedInCompanyUrl(topCompanyAnchor.getAttribute("href")),
        anchor: topCompanyAnchor,
      })
    }
  }

  for (const entry of experienceEntries) {
    if (!entry.company_name) continue
    if (entry === currentExperience) continue
    pushCompanyCandidate(candidates, {
      name: entry.company_name,
      source_container: "experience",
      source_selector: "experience.section.company",
      raw_value: entry.company_name,
      url: entry.linkedin_company_url ?? null,
      anchor: null,
    })
  }

  const candidateNames = []
  const seenNames = new Set()
  for (const candidate of candidates) {
    const key = `${candidate.source_container}|${candidate.source_selector}|${candidate.name}`
    if (seenNames.has(key)) continue
    seenNames.add(key)
    candidateNames.push(candidate.name)
  }

  let selected = null
  for (const candidate of candidates) {
    const sanitized = rejectCompanyIfPersonName(candidate.name, personName)
    const auditEntry = {
      source: candidate.source_container,
      selector: candidate.source_selector,
      value: candidate.raw_value ?? candidate.name,
      accepted: false,
      reject_reason: sanitized ? null : "person-name-match",
    }
    if (sanitized && !selected) {
      auditEntry.accepted = true
      selected = {
        company_name: sanitized,
        linkedin_company_url: candidate.url ?? null,
        source_container: candidate.source_container,
        source_selector: candidate.source_selector,
        raw_value: candidate.raw_value,
        anchor: candidate.anchor,
      }
    }
    const auditKey = `${auditEntry.source}|${auditEntry.selector}|${auditEntry.value}`
    if (!company_candidates.some((entry) => `${entry.source}|${entry.selector}|${entry.value}` === auditKey)) {
      company_candidates.push(auditEntry)
    }
  }

  if (auditBag) auditBag.company_candidates = company_candidates

  console.log("[Equipify Sales:company]", {
    person_name: personName ?? null,
    candidate_company_names: candidateNames,
    selected_company_name: selected?.company_name ?? null,
    source_container: selected?.source_container ?? null,
    source_selector: selected?.source_selector ?? null,
    raw_value: selected?.raw_value ?? null,
  })

  return (
    selected ?? {
      company_name: null,
      linkedin_company_url: null,
      source_container: null,
      source_selector: null,
      raw_value: null,
      anchor: null,
    }
  )
}

function resolveProfileTitleExtraction(topCard, experienceEntries, headlineParts, auditBag) {
  const candidates = []
  const title_candidates = []
  const currentExperience =
    experienceEntries.find((entry) => /\bpresent\b/i.test(entry.date_range ?? "")) ?? experienceEntries[0]

  if (currentExperience?.title) {
    candidates.push({
      title: currentExperience.title,
      source_container: "experience",
      source_selector: "experience.current.title",
      raw_value: currentExperience.title,
    })
  }

  if (headlineParts.title) {
    candidates.push({
      title: headlineParts.title,
      source_container: "top-card",
      source_selector: "top-card.headline",
      raw_value: headlineParts.title,
    })
  }

  for (const entry of experienceEntries) {
    if (!entry.title) continue
    candidates.push({
      title: entry.title,
      source_container: "experience",
      source_selector: "experience.section.title",
      raw_value: entry.title,
    })
  }

  let selected = null
  for (const candidate of candidates) {
    const normalized = normalizeVisibleText(candidate.title)
    const auditEntry = {
      source: candidate.source_container,
      selector: candidate.source_selector,
      value: candidate.raw_value ?? candidate.title,
      accepted: false,
    }
    if (normalized && isPlausibleJobTitle(normalized) && !selected) {
      auditEntry.accepted = true
      selected = {
        title: normalized,
        source_container: candidate.source_container,
        source_selector: candidate.source_selector,
        raw_value: candidate.raw_value,
      }
    }
    const auditKey = `${auditEntry.source}|${auditEntry.selector}|${auditEntry.value}`
    if (!title_candidates.some((entry) => `${entry.source}|${entry.selector}|${entry.value}` === auditKey)) {
      title_candidates.push(auditEntry)
    }
  }

  if (auditBag) auditBag.title_candidates = title_candidates

  console.log("[Equipify Sales:title]", {
    source_container: selected?.source_container ?? null,
    source_selector: selected?.source_selector ?? null,
    raw_value: selected?.raw_value ?? null,
  })

  return selected?.title ?? null
}

function extractExperienceDateRange(itemText) {
  const raw = trimOrNull(itemText)
  if (!raw) return null
  const patterns = [
    /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}\s*[-–—]\s*Present[^·]*/i,
    /\d{4}\s*[-–—]\s*Present[^·]*/i,
    /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4}\s*[-–—]\s*Present/i,
  ]
  for (const pattern of patterns) {
    const match = raw.match(pattern)
    if (match?.[0]) return trimOrNull(match[0])
  }
  if (/\bpresent\b/i.test(raw)) {
    return trimOrNull(raw.match(/[^·]{0,80}\bpresent\b[^·]{0,20}/i)?.[0] ?? null)
  }
  return null
}

function collectExperienceRowCandidates(section) {
  const rows = new Set()
  section
    .querySelectorAll(
      'li, [role="listitem"], div.pvs-list__paged-list-item, [data-view-name="profile-component-entity"]',
    )
    .forEach((el) => rows.add(el))

  if (rows.size === 0) {
    section.querySelectorAll("div, li, article").forEach((el) => {
      if (isInsideForbiddenProfileRegion(el)) return
      const text = el.textContent ?? ""
      if (!/\bpresent\b/i.test(text)) return
      if (!/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d{4})/i.test(text)) return
      if (text.length > 600) return
      const childMatches = [...el.querySelectorAll("div, li")].filter(
        (child) =>
          /\bpresent\b/i.test(child.textContent ?? "") && (child.textContent ?? "").length < 600,
      )
      if (childMatches.length === 0) rows.add(el)
    })
  }

  return [...rows]
}

function isExperienceDurationOrDateText(value) {
  const text = trimOrNull(value)
  if (!text) return true
  if (/^\d+\s+(mo|mos|month|months|yr|yrs|year|years)$/i.test(text)) return true
  if (/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d{4})/i.test(text)) return true
  if (/\bpresent\b/i.test(text)) return true
  if (/·/.test(text) && /\d+\s+(mo|yr)/i.test(text)) return true
  return false
}

function isPlausibleJobTitle(value) {
  const text = normalizeVisibleText(value)
  if (!text || text.length < 3 || text.length > 120) return false
  if (isExperienceDurationOrDateText(text)) return false
  return true
}

function extractExperienceTitleFromRow(item, itemText, companyName) {
  for (const el of item.querySelectorAll("span, div, p")) {
    if (el.querySelector('a[href*="/company/"]')) continue
    if (el.closest('a[href*="/company/"]')) continue
    const text = normalizeVisibleText(el.textContent)
    if (!isPlausibleJobTitle(text)) continue
    if (text === companyName) continue
    return text
  }

  const legacyTitle = normalizeVisibleText(
    trimOrNull(
      item.querySelector(".t-bold span[aria-hidden='true']")?.textContent ??
        item.querySelector(".mr1.hoverable-link-text span")?.textContent ??
        item.querySelector("span[aria-hidden='true']")?.textContent,
    ),
  )
  if (legacyTitle && legacyTitle !== companyName && isPlausibleJobTitle(legacyTitle)) return legacyTitle

  const lines = (itemText ?? "")
    .split(/[\n·|]/)
    .map((line) => normalizeVisibleText(line))
    .filter(Boolean)

  for (const line of lines) {
    if (line === companyName) continue
    if (!isPlausibleJobTitle(line)) continue
    return line
  }
  return null
}

function extractExperienceEntries(doc) {
  const entries = []
  const seen = new Set()
  const section = findExperienceSection(doc)
  if (!section) return []

  for (const item of collectExperienceRowCandidates(section)) {
    if (isInsideForbiddenProfileRegion(item)) continue
    const companyAnchor = item.querySelector('a[href*="/company/"]')
    if (companyAnchor && isInsideForbiddenProfileRegion(companyAnchor)) continue
    const companyName = normalizeVisibleText(trimOrNull(companyAnchor?.textContent))
    const companyUrl = normalizeLinkedInCompanyUrl(companyAnchor?.getAttribute("href"))
    const itemText = normalizeVisibleText(item.textContent) ?? ""
    const title = extractExperienceTitleFromRow(item, itemText, companyName)
    const dateText = extractExperienceDateRange(itemText)
    const key = `${companyName ?? ""}|${title ?? ""}|${dateText ?? ""}`
    if (!companyName && !title) continue
    if (seen.has(key)) continue
    seen.add(key)
    entries.push({
      company_name: companyName,
      title,
      linkedin_company_url: companyUrl,
      date_range: dateText,
    })
  }

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
  const legacyTopCard = findProfileTopCardLegacy(doc)
  const discovered = discoverProfileTopCard(doc)
  const topCard = legacyTopCard ?? discovered.topCard
  const nameNode = discovered.nameNode ?? topCard?.querySelector("h1")
  const experienceSection = findExperienceSection(doc)
  const experienceHeading = findSectionHeadingElement(doc, "Experience")
  const mainContentContainer = discoverMainContentContainer(doc, topCard)

  const contact_name =
    cleanLinkedInProfileName(
      queryTextInContainer(topCard, ["h1.text-heading-xlarge", "h1.break-words", "h1"]) ??
        trimOrNull(nameNode?.textContent),
    ) ?? inferLinkedInProfileNameFromTitle(doc.title)

  const headline = normalizeVisibleText(
    queryTextInContainer(topCard, [
      "div.text-body-medium.break-words",
      ".pv-text-details__left-panel .text-body-medium",
      ".ph5.pb5 .text-body-medium",
      ".text-body-medium:not(.t-black--light)",
      ".top-card-layout__headline",
      "[data-view-name='profile-header'] .text-body-medium",
    ]) ?? trimOrNull(findHeadlineNearName(nameNode)?.textContent),
  )

  const location = extractProfileLocation(topCard) ?? findLocationNearName(nameNode, topCard)

  const profile_photo_url = findProfilePhotoUrl(doc, topCard, nameNode)

  const headlineParts = parseLinkedInHeadline(headline)
  const experienceEntries = extractExperienceEntries(doc)
  const educationEntries = extractEducationEntries(doc)
  const extractionAudit = {}
  const companySelection = resolveProfileCompanyExtraction(
    topCard,
    experienceSection,
    contact_name,
    experienceEntries,
    extractionAudit,
    headline,
  )
  const parsedHeadline = parseConcatenatedHeadlineTitleCompany(headline)
  const current_company = companySelection.company_name
  const current_title =
    resolveProfileTitleExtraction(topCard, experienceEntries, headlineParts, extractionAudit) ??
    parsedHeadline.title

  const linkedin_company_url = companySelection.linkedin_company_url
  const companyAnchor = companySelection.anchor ?? findTopCardCompanyAnchor(topCard)
  const company_logo_url =
    companyAnchor && topCard?.contains(companyAnchor)
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
    education_entries: educationEntries,
  }

  logHeroDiscovery(topCard)
  logExperienceDiscovery(
    buildExperienceDiscoveryAudit(doc, experienceSection, experienceHeading),
  )
  logCompanySelection(extractionAudit, companySelection)
  logDomAudit(
    buildDomAudit(document, {
      nameNode,
      topCard,
      experienceSection,
      experienceHeading,
      profilePhotoUrl: profile_photo_url,
      headline,
      personName: contact_name,
    }),
  )

  if (!experienceSection) scheduleExperienceRetryExtract()

  logExtractionAudit({
    profile_url: cleanPageUrl(window.location.href),
    profile_name: contact_name,
    top_card: auditTopCardDiscovery(doc, topCard, nameNode),
    experience_section: auditExperienceDiscovery(doc, experienceSection),
    company_candidates: extractionAudit.company_candidates ?? [],
    title_candidates: extractionAudit.title_candidates ?? [],
    experience_entries: experienceEntries.map((entry) => ({
      title: entry.title ?? null,
      company: entry.company_name ?? null,
      date_range: entry.date_range ?? null,
      current_role: /\bpresent\b/i.test(entry.date_range ?? ""),
    })),
    education_entries: educationEntries.map((entry) => ({
      school: entry.school_name ?? null,
    })),
    selected: {
      title: current_title,
      company: current_company,
      source: companySelection.source_selector,
    },
  })
  logDomMap({
    nameNode,
    experienceHeading,
    topCard,
    experienceSection,
    mainContentContainer,
  })
  logDomSnapshot(doc, topCard, experienceSection)

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
  console.log("[Equipify Sales] extractVisiblePageMetadata invoked")
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
    profile_photo_url: linkedinExtract.profile_photo_url ?? null,
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

function readManifestVersion() {
  try {
    return chrome.runtime.getManifest()?.version ?? null
  } catch {
    return null
  }
}

function resolveLinkedInPageKindForStartup(url) {
  return (
    window.EquipifyGrowthLinkedInContext?.detectLinkedInPageKind?.(url) ??
    detectLinkedInPageKind(url)
  )
}

function scheduleExperienceRetryExtract() {
  if (typeof window === "undefined" || window.__equipifyGrowthExperienceRetryScheduled) return
  window.__equipifyGrowthExperienceRetryScheduled = true

  let attempts = 0
  const maxAttempts = 20
  const timer = window.setInterval(() => {
    attempts += 1
    const section = findExperienceSection(document)
    if (section && isExperienceContainerValid(section)) {
      window.clearInterval(timer)
      delete window.__equipifyGrowthExperienceRetryScheduled
      try {
        extractVisiblePageMetadata()
      } catch (error) {
        console.error("[Equipify Sales:startup]", "experience_retry_extract_failed", error)
      }
      return
    }
    if (attempts >= maxAttempts) {
      window.clearInterval(timer)
      delete window.__equipifyGrowthExperienceRetryScheduled
    }
  }, 500)
}

function emitStartupDiagnostic() {
  const url = window.location.href
  console.log("[Equipify Sales:startup]", {
    url,
    pageKind: resolveLinkedInPageKindForStartup(url),
    manifestVersion: readManifestVersion(),
    contentScriptLoaded: true,
    metadataExtractorLoaded: typeof extractVisiblePageMetadata === "function",
  })
}

function scheduleDiagnosticProfileExtract() {
  const pageKind = resolveLinkedInPageKindForStartup(window.location.href)
  if (pageKind !== "profile") return

  window.setTimeout(() => {
    try {
      extractVisiblePageMetadata()
    } catch (error) {
      console.error("[Equipify Sales:startup]", "diagnostic_profile_extract_failed", error)
    }
  }, 750)
}

if (typeof window !== "undefined") {
  window.__equipifyGrowthExtract = extractVisiblePageMetadata
  window.__equipifyGrowthParseLinkedInHeadline = parseLinkedInHeadline
  window.__equipifyGrowthNormalizeVisibleText = normalizeVisibleText
  window.__equipifyGrowthRejectCompanyIfPersonName = rejectCompanyIfPersonName
  window.__equipifyGrowthResolveProfileCompanyExtraction = resolveProfileCompanyExtraction
  window.__equipifyGrowthFindProfileTopCard = findProfileTopCard
  window.__equipifyGrowthFindExperienceSection = findExperienceSection
  window.__equipifyGrowthDiscoverMainContentContainer = discoverMainContentContainer
  window.__equipifyGrowthDescribeElement = describeElementForAudit
  window.__equipifyGrowthResolveProfileTitleExtraction = resolveProfileTitleExtraction
  emitStartupDiagnostic()
  scheduleDiagnosticProfileExtract()
}
