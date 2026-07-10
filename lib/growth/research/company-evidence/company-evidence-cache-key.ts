/** GE-AIOS-22 — Company evidence cache key (server-only). */

import "server-only"

import { createHash } from "node:crypto"

export function buildCompanyEvidenceCacheKey(input: {
  companyName: string
  website: string | null
  missionTitle?: string | null
  profileVersion?: string | null
}): string {
  const payload = [
    input.companyName.trim().toLowerCase(),
    (input.website ?? "").trim().toLowerCase(),
    (input.missionTitle ?? "").trim().toLowerCase(),
    (input.profileVersion ?? "v1").trim().toLowerCase(),
  ].join("|")
  return createHash("sha256").update(payload).digest("hex").slice(0, 32)
}
