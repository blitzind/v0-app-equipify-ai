/**
 * Visible LinkedIn company page people extraction — no API calls, DOM-visible links only.
 */
function trimOrNull(value) {
  const trimmed = typeof value === "string" ? value.trim() : ""
  return trimmed ? trimmed : null
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

function extractVisibleLinkedInCompanyPeople() {
  const people = []
  const seen = new Set()

  document.querySelectorAll('a[href*="/in/"]').forEach((anchor) => {
    const linkedinUrl = normalizeLinkedInProfileUrl(anchor.getAttribute("href") ?? anchor.href)
    if (!linkedinUrl || seen.has(linkedinUrl)) return

    const name = trimOrNull(anchor.textContent)
    if (!name || name.length < 2 || name.length > 80) return
    if (/^(see all|view all|show more|linkedin|connect|message)$/i.test(name)) return

    seen.add(linkedinUrl)

    let jobTitle = null
    const container = anchor.closest("li, div, section, article")
    if (container) {
      const lines = (container.innerText ?? "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
      jobTitle =
        lines.find((line) => line !== name && line.length > 2 && line.length < 120) ?? null
    }

    people.push({
      full_name: name,
      job_title: jobTitle,
      linkedin_url: linkedinUrl,
      source_url: linkedinUrl,
      source: "linkedin_visible_page",
    })
  })

  return people.slice(0, 25)
}

if (typeof window !== "undefined") {
  window.__equipifyGrowthLinkedInCompanyPeople = extractVisibleLinkedInCompanyPeople
}
