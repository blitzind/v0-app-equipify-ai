/**
 * GE-AIOS-NEXT-3C — Read-only Production validation for executive reasoning.
 * Run: pnpm probe:ge-aios-next-3c-executive-reasoning-production-readonly
 */
import { getGrowthEngineAiOrgId } from "@/lib/growth/access"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { loadGrowthHomeAvaExecutiveReasoningFromProduction } from "@/lib/growth/ava-home/recommendations/growth-home-ava-executive-reasoning-production-loader-next-3c"
import {
  assertExecutiveLanguageProfessional,
  buildExecutiveReasoningLines,
} from "@/lib/growth/ava-home/recommendations/growth-home-ava-executive-reasoning-next-3c"
import { GROWTH_AIOS_NEXT_3C_EXECUTIVE_REASONING_QA_MARKER } from "@/lib/growth/ava-home/recommendations/growth-home-ava-executive-reasoning-next-3c-types"

export const GE_AIOS_NEXT_3C_PRODUCTION_EVIDENCE_QA_MARKER =
  "ge-aios-next-3c-executive-reasoning-production-evidence-v1" as const

async function main(): Promise<void> {
  const boot = await bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: true })
  if (!boot) throw new Error("production_bootstrap_failed")
  const organizationId = getGrowthEngineAiOrgId() || EQUIPIFY_PRODUCTION_ORG_ID

  const result = await loadGrowthHomeAvaExecutiveReasoningFromProduction({
    admin: boot.admin,
    organizationId,
    outboundDisabled: true,
  })

  const { reasoning } = result
  if (reasoning.qaMarker !== GROWTH_AIOS_NEXT_3C_EXECUTIVE_REASONING_QA_MARKER) {
    throw new Error("reasoning_qa_marker_mismatch")
  }
  if (!reasoning.primary) throw new Error("missing_primary_reasoning_block")

  const texts = [
    reasoning.primary.observation,
    reasoning.primary.confidenceReason,
    reasoning.primary.recommendation,
    reasoning.synthesisSummary,
    ...buildExecutiveReasoningLines(reasoning),
  ].filter((value): value is string => Boolean(value))

  for (const text of texts) {
    if (!assertExecutiveLanguageProfessional(text)) {
      throw new Error(`unprofessional_language:${text.slice(0, 80)}`)
    }
  }

  console.log(
    JSON.stringify(
      {
        qaMarker: GE_AIOS_NEXT_3C_PRODUCTION_EVIDENCE_QA_MARKER,
        readOnly: true,
        organizationId,
        reasoningQaMarker: reasoning.qaMarker,
        primary: reasoning.primary,
        supportingCount: reasoning.supporting.length,
        synthesisSummary: reasoning.synthesisSummary,
        executiveReasoningLines: buildExecutiveReasoningLines(reasoning),
      },
      null,
      2,
    ),
  )
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})
