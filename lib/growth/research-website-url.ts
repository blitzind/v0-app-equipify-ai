import "server-only"

import { lookup } from "node:dns/promises"
import { isIP } from "node:net"

export const GROWTH_LEAD_WEBSITE_FETCH_STATUSES = [
  "skipped",
  "ok",
  "timeout",
  "blocked",
  "too_large",
  "invalid_url",
  "error",
] as const

export type GrowthLeadWebsiteFetchStatus = (typeof GROWTH_LEAD_WEBSITE_FETCH_STATUSES)[number]

export type NormalizeLeadWebsiteResult =
  | { status: "skipped"; url: null }
  | { status: "invalid_url"; url: null }
  | { status: "ready"; url: string }

const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".corp"] as const
const ALLOWED_PORTS = new Set([80, 443])

function decodeBasicEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
}

export function normalizeLeadWebsite(raw: string | null | undefined): NormalizeLeadWebsiteResult {
  const trimmed = raw?.trim()
  if (!trimmed) return { status: "skipped", url: null }

  let candidate = trimmed
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(candidate)) {
    candidate = `https://${candidate}`
  }

  let parsed: URL
  try {
    parsed = new URL(candidate)
  } catch {
    return { status: "invalid_url", url: null }
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { status: "invalid_url", url: null }
  }

  const hostname = parsed.hostname.trim().toLowerCase()
  if (!hostname) return { status: "invalid_url", url: null }

  parsed.hash = ""
  const port = parsed.port ? Number.parseInt(parsed.port, 10) : parsed.protocol === "https:" ? 443 : 80
  if (!ALLOWED_PORTS.has(port)) {
    return { status: "invalid_url", url: null }
  }

  return { status: "ready", url: parsed.href }
}

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "")
  if (!host) return true
  if (host === "localhost") return true
  if (host === "metadata.google.internal") return true
  if (host === "metadata") return true
  if (!host.includes(".")) return true
  return BLOCKED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))
}

function isBlockedIpv4(ip: string): boolean {
  const parts = ip.split(".").map((part) => Number.parseInt(part, 10))
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part) || part < 0 || part > 255)) {
    return true
  }
  const [a, b] = parts
  if (a === 10 || a === 127 || a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  return false
}

function isBlockedIpv6(ip: string): boolean {
  const lower = ip.toLowerCase()
  if (lower === "::1") return true
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true
  if (lower.startsWith("fe80")) return true
  if (lower.startsWith("::ffff:")) {
    const mapped = lower.slice("::ffff:".length)
    const ipKind = isIP(mapped)
    if (ipKind === 4) return isBlockedIpv4(mapped)
  }
  return false
}

function isBlockedIpAddress(value: string): boolean {
  const kind = isIP(value)
  if (kind === 4) return isBlockedIpv4(value)
  if (kind === 6) return isBlockedIpv6(value)
  return true
}

export async function assertLeadWebsiteUrlSafe(url: string): Promise<{ ok: true } | { ok: false; status: "blocked" }> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { ok: false, status: "blocked" }
  }

  const hostname = parsed.hostname.toLowerCase()
  if (isBlockedHostname(hostname)) {
    return { ok: false, status: "blocked" }
  }

  const ipKind = isIP(hostname)
  if (ipKind) {
    return isBlockedIpAddress(hostname) ? { ok: false, status: "blocked" } : { ok: true }
  }

  try {
    const records = await lookup(hostname, { all: true, verbatim: true })
    if (!records.length) return { ok: false, status: "blocked" }
    for (const record of records) {
      if (isBlockedIpAddress(record.address)) {
        return { ok: false, status: "blocked" }
      }
    }
    return { ok: true }
  } catch {
    return { ok: false, status: "blocked" }
  }
}

export function hostnameForLog(url: string | null): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

export function truncateWebsiteExcerpt(text: string, maxChars: number): string {
  const trimmed = text.trim()
  if (trimmed.length <= maxChars) return trimmed
  return `${trimmed.slice(0, maxChars - 1).trim()}…`
}

export function decodeBasicHtmlEntities(value: string): string {
  return decodeBasicEntities(value)
}
