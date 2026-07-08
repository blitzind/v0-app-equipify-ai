/** GE-AIOS-8A-2 — Evidence Engine input hash for dedupe (client-safe). */

import { createHash } from "node:crypto"

import type { EvidenceEngineProvider } from "@/lib/growth/evidence-engine/evidence-engine-types"

export const EVIDENCE_ENGINE_EXTRACTION_VERSION = "ge-aios-8a-2-v1" as const

export function buildEvidenceEngineInputHash(input: {
  organizationId: string
  websiteUrl?: string | null
  providers: EvidenceEngineProvider[]
  extractionVersion?: string
  approvedProfileId?: string | null
  approvedProfileUpdatedAt?: string | null
}): string {
  const providers = [...input.providers].sort().join(",")
  const payload = [
    input.organizationId.trim(),
    (input.websiteUrl ?? "").trim().toLowerCase(),
    providers,
    input.extractionVersion ?? EVIDENCE_ENGINE_EXTRACTION_VERSION,
    input.approvedProfileId ?? "",
    input.approvedProfileUpdatedAt ?? "",
  ].join("|")

  return createHash("sha256").update(payload).digest("hex").slice(0, 32)
}
