export function trimOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function normalizeEmail(value: string | null | undefined): string | null {
  const trimmed = trimOrNull(value)?.toLowerCase()
  if (!trimmed) return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null
  return trimmed
}

export function normalizePhone(value: string | null | undefined): string | null {
  const digits = (value ?? "").replace(/\D/g, "")
  if (digits.length < 10) return null
  return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits.slice(-10)
}

export function normalizeWebsiteDomain(value: string | null | undefined): string | null {
  const raw = trimOrNull(value)
  if (!raw) return null
  try {
    const withProtocol = raw.includes("://") ? raw : `https://${raw}`
    const url = new URL(withProtocol)
    let host = url.hostname.toLowerCase()
    if (host.startsWith("www.")) host = host.slice(4)
    return host || null
  } catch {
    const cleaned = raw.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]
    return cleaned || null
  }
}

export function normalizeCompanyName(value: string | null | undefined): string | null {
  const trimmed = trimOrNull(value)
  if (!trimmed) return null
  return trimmed
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|corp|corporation|co|company)\b\.?/gi, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

export function normalizeLinkedIn(value: string | null | undefined): string | null {
  const raw = trimOrNull(value)?.toLowerCase()
  if (!raw) return null
  const match = raw.match(/linkedin\.com\/in\/([^/?#]+)/i) ?? raw.match(/^\/in\/([^/?#]+)/i)
  if (match?.[1]) return match[1].replace(/\/$/, "")
  if (!raw.includes("/")) return raw.replace(/\/$/, "")
  return raw
}

export function normalizeWebsiteUrl(value: string | null | undefined): string | null {
  const raw = trimOrNull(value)
  if (!raw) return null
  if (raw.includes("://")) return raw
  return `https://${raw}`
}
