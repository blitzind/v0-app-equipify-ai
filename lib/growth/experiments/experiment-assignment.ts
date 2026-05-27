import { hashVariationSeed, pickVariantIndex } from "@/lib/growth/outreach/personalization/message-variability"
import type { GrowthSequenceExperimentVariant } from "@/lib/growth/experiments/experiment-types"

export function buildExperimentAssignmentSeed(leadId: string, experimentId: string): string {
  return `${experimentId}:${leadId}`
}

export function buildExperimentAssignmentHash(leadId: string, experimentId: string): string {
  return String(hashVariationSeed(buildExperimentAssignmentSeed(leadId, experimentId)))
}

export function pickExperimentVariantByWeight(
  leadId: string,
  experimentId: string,
  variants: Array<Pick<GrowthSequenceExperimentVariant, "id" | "weight" | "status">>,
): GrowthSequenceExperimentVariant["id"] | null {
  const active = variants.filter((variant) => variant.status === "active")
  if (active.length === 0) return null

  const totalWeight = active.reduce((sum, variant) => sum + Math.max(1, variant.weight), 0)
  if (totalWeight <= 0) return active[0]?.id ?? null

  const bucket = hashVariationSeed(buildExperimentAssignmentSeed(leadId, experimentId)) % totalWeight
  let cursor = 0
  for (const variant of active) {
    cursor += Math.max(1, variant.weight)
    if (bucket < cursor) return variant.id
  }
  return active[active.length - 1]?.id ?? null
}

export function pickExperimentVariantIndex(leadId: string, experimentId: string, variantCount: number): number {
  return pickVariantIndex(buildExperimentAssignmentSeed(leadId, experimentId), variantCount)
}
