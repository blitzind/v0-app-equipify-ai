const CONSUMER_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "protonmail.com",
  "proton.me",
  "mail.com",
  "gmx.com",
  "yandex.com",
  "zoho.com",
  "att.net",
  "sbcglobal.net",
  "comcast.net",
  "verizon.net",
  "bellsouth.net",
  "charter.net",
  "roadrunner.com",
  "earthlink.net",
  "cox.net",
  "optonline.net",
  "frontier.com",
  "windstream.net",
  "juno.com",
  "netzero.net",
])

const SEARCH_ENGINE_HOST_FRAGMENTS = [
  "google.",
  "bing.",
  "duckduckgo.",
  "yahoo.",
  "search.brave.",
  "ecosia.",
]

export function normalizeCompanyName(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 200)
}

export function normalizeDomain(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim().toLowerCase()
  if (!raw) return null

  let host = raw
  try {
    if (raw.includes("://")) {
      host = new URL(raw).hostname
    } else if (raw.includes("/")) {
      host = raw.split("/")[0] ?? raw
    } else {
      host = raw.split("/")[0]?.split("?")[0] ?? raw
    }
  } catch {
    host = raw.split("/")[0]?.split("?")[0] ?? raw
  }

  host = host.replace(/^www\./, "").trim()
  if (!host || host === "localhost" || host === "127.0.0.1") return null
  if (!host.includes(".")) return null
  return host
}

export function extractDomainFromEmail(email: string | null | undefined): string | null {
  const normalized = (email ?? "").trim().toLowerCase()
  const at = normalized.lastIndexOf("@")
  if (at < 0) return null
  return normalizeDomain(normalized.slice(at + 1))
}

export function isConsumerEmailDomain(domain: string | null | undefined): boolean {
  const d = normalizeDomain(domain)
  if (!d) return false
  return CONSUMER_EMAIL_DOMAINS.has(d)
}

export function isSearchEngineHost(host: string): boolean {
  const h = host.toLowerCase()
  return SEARCH_ENGINE_HOST_FRAGMENTS.some((frag) => h.includes(frag))
}

export function domainToCompanyNameHint(domain: string): string {
  const base = domain.split(".")[0] ?? domain
  return base
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export function extractBusinessReferrerDomain(referrer: string | null | undefined): string | null {
  const domain = normalizeDomain(referrer)
  if (!domain) return null
  if (isSearchEngineHost(domain)) return null
  return domain
}
