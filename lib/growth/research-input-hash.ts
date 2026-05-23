import "server-only"

import { createHash } from "node:crypto"

/** Business-level cache key for Growth lead research (separate from AI provider cache). */
export function growthLeadResearchInputHash(input: {
  companyName: string
  website: string | null
  contactName: string | null
  regenerate: boolean
}): string {
  const payload = JSON.stringify({
    company_name: input.companyName.trim().toLowerCase(),
    website: (input.website ?? "").trim().toLowerCase(),
    contact_name: (input.contactName ?? "").trim().toLowerCase(),
    regenerate: Boolean(input.regenerate),
  })
  return createHash("sha256").update(payload).digest("hex")
}

export const GROWTH_LEAD_RESEARCH_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000
