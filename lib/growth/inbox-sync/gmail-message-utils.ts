export type GmailHeader = { name: string; value: string }

export function normalizeRfcMessageId(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim()
  if (!trimmed) return null
  return trimmed.replace(/^<|>$/g, "").trim() || null
}

export function parseReferencesHeader(value: string | null | undefined): string[] {
  if (!value?.trim()) return []
  const matches = value.match(/<[^>]+>|[^\s<>]+@[^\s<>]+/g) ?? []
  return matches
    .map((part) => normalizeRfcMessageId(part))
    .filter((part): part is string => Boolean(part))
}

export function getGmailHeader(headers: GmailHeader[] | undefined, name: string): string | null {
  const target = name.toLowerCase()
  const header = (headers ?? []).find((row) => row.name.toLowerCase() === target)
  return header?.value?.trim() || null
}

export function parseEmailAddress(value: string | null | undefined): string | null {
  if (!value?.trim()) return null
  const match = value.match(/<([^>]+)>/)
  const email = (match?.[1] ?? value).trim().toLowerCase()
  return email.includes("@") ? email : null
}
