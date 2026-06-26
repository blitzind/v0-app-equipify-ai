/** GE-AIOS-2J — Context Package checksum (client-safe). */

import { createHash } from "node:crypto"
import type { AiContextPackageContent } from "@/lib/growth/aios/ai-context-assembly-types"

function stableSerialize(value: unknown): string {
  if (value === null || value === undefined) return "null"
  if (typeof value !== "object") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`
  const record = value as Record<string, unknown>
  const keys = Object.keys(record).sort()
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(",")}}`
}

export function computeAiContextPackageChecksum(content: AiContextPackageContent): string {
  const payload = stableSerialize({
    contextVersion: content.contextVersion,
    workOrderContext: content.workOrderContext,
    missionContext: content.missionContext,
    decisionHistory: content.decisionHistory,
    memoryReferences: content.memoryReferences,
    relatedEvents: content.relatedEvents,
    evidenceBundle: content.evidenceBundle,
    entityMetadata: content.entityMetadata,
    sourceKeys: [...content.sourceKeys].sort(),
  })
  return createHash("sha256").update(payload).digest("hex")
}

export function verifyAiContextPackageChecksum(
  content: AiContextPackageContent,
  checksum: string,
): boolean {
  return computeAiContextPackageChecksum(content) === checksum
}
