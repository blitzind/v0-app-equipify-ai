/**
 * AVA-HOME-AFTER-ACTION-AND-FOCUS-TRUTH-HOTFIX-1A — Production read-only probe.
 * Run: pnpm probe:ava-home-after-action-and-focus-truth-hotfix-1a:production
 */

import { listGrowthAiCopilotGenerationsForLead } from "@/lib/growth/ai-copilot-repository"
import {
  hasValidMessageApprovalBindingForGeneration,
  resolveAvaSupervisedOutboundApprovalPresentation,
} from "@/lib/growth/ava-reasoning/ava-supervised-outbound-approval-state-core"
import { isAvaSupervisedOutboundGeneration } from "@/lib/growth/ava-reasoning/ava-supervised-outbound-1a-types"
import {
  buildSupervisedAvaHomeOperatorAttention,
  loadSupervisedAvaGenerationsForHome,
} from "@/lib/growth/ava-reasoning/equipify-supervised-home-projection-1a"
import { buildGrowthHomeReviewQueuePresentation, buildSupervisedReadyByLeadIdMap } from "@/lib/growth/home/growth-home-review-queue-1b"
import { mergeSupervisedAvaIntoApprovalSnapshot } from "@/lib/growth/ava-reasoning/equipify-supervised-home-projection-1a"
import { emptyCanonicalOperatorApprovalSnapshot } from "@/lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a"
import { resolveDraftFactoryDurableRepository } from "@/lib/growth/draft-factory/draft-factory-durable-repository-factory"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "@/lib/growth/notifications/growth-notification-cert-bootstrap"
import { createServiceRoleClient } from "@/lib/supabase/admin"

const CERT_ID = "ava-home-after-action-and-focus-truth-hotfix-1a-v1" as const

async function findMcdonaldsLead(admin: NonNullable<ReturnType<typeof createServiceRoleClient>>) {
  const { data, error } = await admin
    .schema("growth")
    .from("leads")
    .select("id, company_name, website, status, source_detail, metadata, contact_name, contact_email")
    .ilike("company_name", "%mcdonald%")
    .limit(5)
  if (error) throw new Error(error.message)
  return data?.[0]
    ? {
        id: String(data[0].id),
        companyName: String(data[0].company_name ?? ""),
        website: (data[0].website as string | null) ?? null,
        status: String(data[0].status ?? ""),
        sourceDetail: (data[0].source_detail as string | null) ?? null,
        metadata: (data[0].metadata as Record<string, unknown>) ?? {},
        contactName: (data[0].contact_name as string | null) ?? null,
        contactEmail: (data[0].contact_email as string | null) ?? null,
      }
    : null
}

async function main() {
  bootstrapGrowthOperatorNotificationsCertEnv()
  const admin = createServiceRoleClient()
  if (!admin) throw new Error("Service role client unavailable")

  const orgId = EQUIPIFY_PRODUCTION_ORG_ID
  const mcdLead = await findMcdonaldsLead(admin)

  let dfState = null
  if (mcdLead) {
    const resolved = await resolveDraftFactoryDurableRepository({ runtime: "production", admin })
    if (resolved.kind === "postgres") {
      dfState = await resolved.repository.getLeadState(orgId, mcdLead.id)
    }
  }

  const diversePowerId = "fd0274c4-5aa5-4524-ac1a-db6a64bb41f5"
  const diverseGens = await listGrowthAiCopilotGenerationsForLead(admin, diversePowerId).catch(() => [])
  const diverseSupervised = diverseGens.filter((gen) => isAvaSupervisedOutboundGeneration(gen))
  const diverseLatest = diverseSupervised[0] ?? null

  let mcdGenerations = []
  if (mcdLead) {
    mcdGenerations = await loadSupervisedAvaGenerationsForHome(admin, [mcdLead.id])
  }

  const mcdAttention = mcdLead
    ? buildSupervisedAvaHomeOperatorAttention({
        generations: mcdGenerations,
        leadsById: new Map([[mcdLead.id, mcdLead.companyName]]),
      })
    : null

  const diverseAttention = buildSupervisedAvaHomeOperatorAttention({
    generations: diverseSupervised,
    leadsById: new Map([[diversePowerId, "Diverse Power Foundation"]]),
  })
  const diverseSnapshot = mergeSupervisedAvaIntoApprovalSnapshot({
    base: emptyCanonicalOperatorApprovalSnapshot(),
    attention: diverseAttention,
  })
  const diverseQueue = buildGrowthHomeReviewQueuePresentation({
    packages: diverseSnapshot.packages,
    supervisedReadyByLeadId: buildSupervisedReadyByLeadIdMap(
      diverseAttention.readyForReview,
      diverseAttention.approvedReadyToSend,
    ),
  })

  console.log(
    JSON.stringify(
      {
        certId: CERT_ID,
        mcdonalds: mcdLead
          ? {
              leadId: mcdLead.id,
              companyName: mcdLead.companyName,
              website: mcdLead.website,
              status: mcdLead.status,
              sourceDetail: mcdLead.sourceDetail,
              metadata: {
                admissionState: (mcdLead.metadata as Record<string, unknown>)?.admission_state ?? null,
                prospectSearch: (mcdLead.metadata as Record<string, unknown>)?.prospect_search ?? null,
              },
              draftFactoryState: dfState?.state ?? null,
              draftFactoryPackageId: dfState?.packageId ?? null,
              supervisedGenerationCount: mcdGenerations.length,
              gptDecisions: mcdGenerations.map((gen) => ({
                id: gen.id,
                primary: (gen.classification as Record<string, unknown>)?.primary ?? null,
                status: gen.status,
              })),
              homeAttention: mcdAttention,
            }
          : null,
        diversePowerApprovedPackage: diverseLatest
          ? {
              generationId: diverseLatest.id,
              status: diverseLatest.status,
              presentation: resolveAvaSupervisedOutboundApprovalPresentation(diverseLatest),
              hasApprovalBinding: hasValidMessageApprovalBindingForGeneration(diverseLatest),
              homeQueueRow: diverseQueue.rows.find((row) => row.leadId === diversePowerId) ?? null,
            }
          : null,
        invariants: { approvedDuringProbe: false, sentDuringProbe: false },
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
