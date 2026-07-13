/**
 * GE-AIOS-EQUIPIFY-MASTER-KNOWLEDGE-1A — Master Context Document file reader (server/scripts only).
 * MCD is ingestion-only — never outreach runtime SoT.
 */

import fs from "node:fs"
import path from "node:path"
import {
  enrichBusinessProfileWithEquipifyMasterKnowledge,
  refreshBusinessProfileFromMasterContext,
  type MasterContextIngestionHints,
} from "@/lib/growth/business-profile/equipify-master-knowledge-merge"
import { GROWTH_AIOS_EQUIPIFY_MASTER_KNOWLEDGE_1A_QA_MARKER } from "@/lib/growth/business-profile/equipify-master-knowledge-types"
import type { BusinessProfileDraftContent } from "@/lib/growth/business-profile/business-profile-types"

const MASTER_CONTEXT_DOC_PATH = path.join(process.cwd(), "docs/MASTER_CONTEXT_DOCUMENT.md")
const MASTER_CONTEXT_MANUAL_BEFORE_PATH = path.join(
  process.cwd(),
  "lib/admin/master-context.manual.before.md",
)

function firstMatchingLine(source: string, pattern: RegExp): string | null {
  for (const line of source.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (pattern.test(trimmed)) return trimmed.replace(/^[-*]\s+/, "")
  }
  return null
}

export function extractMasterContextIngestionHints(
  options: { now?: string } = {},
): MasterContextIngestionHints {
  const ingestedSections: string[] = []
  let platformSummary: string | null = null
  let corePlatformStatus: string | null = null
  let staffAppAudience: string | null = null

  const readSafe = (filePath: string): string | null => {
    try {
      return fs.readFileSync(filePath, "utf8")
    } catch {
      return null
    }
  }

  const manualBefore = readSafe(MASTER_CONTEXT_MANUAL_BEFORE_PATH)
  if (manualBefore) {
    platformSummary =
      firstMatchingLine(manualBefore, /^Equipify\.ai is a multi-tenant/i) ||
      firstMatchingLine(manualBefore, /^Equipify is a multi-tenant/i)
    if (platformSummary) ingestedSections.push("platform_summary")
  }

  const mcd = readSafe(MASTER_CONTEXT_DOC_PATH)
  if (mcd) {
    corePlatformStatus = firstMatchingLine(
      mcd,
      /Production SaaS for equipment service businesses/i,
    )
    if (corePlatformStatus) ingestedSections.push("core_platform_status")

    staffAppAudience = firstMatchingLine(mcd, /staff app targets dispatchers/i)
    if (!staffAppAudience) {
      staffAppAudience =
        "Staff app targets dispatchers, technicians, and back-office roles; portal targets customer contacts."
    }
    if (staffAppAudience) ingestedSections.push("staff_app_audience")
  }

  return {
    platformSummary,
    corePlatformStatus,
    staffAppAudience,
    ingestedSections,
    sourceMarker: `${GROWTH_AIOS_EQUIPIFY_MASTER_KNOWLEDGE_1A_QA_MARKER}:${options.now ?? "static"}`,
  }
}

export function enrichBusinessProfileFromMasterContextDocument(
  profile: BusinessProfileDraftContent,
  options: { ingestedAt?: string } = {},
): BusinessProfileDraftContent {
  const ingestedAt = options.ingestedAt ?? new Date().toISOString()
  const hints = extractMasterContextIngestionHints({ now: ingestedAt })
  return enrichBusinessProfileWithEquipifyMasterKnowledge(profile, { ingestedAt, hints })
}

export { enrichBusinessProfileWithEquipifyMasterKnowledge, refreshBusinessProfileFromMasterContext }
