/**
 * GE-AIOS-AUTONOMY-1H — Controlled Block Imaging package payload recovery.
 *
 * Original body was never written to growth.autonomous_outreach_preparation_runs.
 * Rebuild with the same package_id / generatedAt so Draft Factory's existing pointer
 * resolves. Does NOT mutate Draft Factory state, approve, or send.
 *
 *   vercel env run -e production -- \
 *     node -r ./scripts/server-only-shim.cjs --import tsx \
 *     scripts/recover-ge-aios-autonomy-1h-block-imaging-package.ts
 */

import { createClient } from "@supabase/supabase-js"
import {
  GROWTH_AIOS_AUTONOMY_1H_QA_MARKER,
  parseOutreachPrepPackageId,
} from "../lib/growth/aios/growth/growth-autonomous-outreach-preparation-package-id"
import {
  findAutonomousOutreachPreparationRunByPackageId,
} from "../lib/growth/aios/growth/growth-autonomous-outreach-preparation-pilot-store"
import { recoverAutonomousOutreachApprovalPackagePayload } from "../lib/growth/aios/growth/growth-autonomous-outreach-preparation-package-persistence"

const ORG = "5876176a-61ec-4532-ad99-0c31482d5a91"
const BLOCK = "6d9220f0-2960-468c-b4be-5d7595d292c3"
const PKG =
  "outreach-prep:6d9220f0-2960-468c-b4be-5d7595d292c3:2026-07-13T16:40:40.229Z"

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

async function main() {
  console.log(`[${GROWTH_AIOS_AUTONOMY_1H_QA_MARKER}] Block Imaging package recovery`)

  const parsed = parseOutreachPrepPackageId(PKG)
  if (!parsed || parsed.leadId !== BLOCK) {
    throw new Error("Package ID parse failed")
  }

  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL")
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY")
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const before = await findAutonomousOutreachPreparationRunByPackageId(admin, ORG, PKG)
  if (
    before?.approvalPackage?.packageId === PKG &&
    before.approvalPackage.pendingHumanApproval === true &&
    before.approvalPackage.transportBlocked === true &&
    (before.approvalPackage.generatedAssets?.length ?? 0) > 0
  ) {
    console.log(
      JSON.stringify(
        {
          status: "already_present",
          package_id: PKG,
          asset_count: before.approvalPackage.generatedAssets.length,
          pending_human_approval: true,
          transport_blocked: true,
          reused: true,
        },
        null,
        2,
      ),
    )
    return
  }

  console.log(
    JSON.stringify({
      status: "recovering",
      reason: before ? "row_without_full_body" : "no_row",
      package_id: PKG,
      generated_at: parsed.generatedAt,
    }),
  )

  const recovered = await recoverAutonomousOutreachApprovalPackagePayload(admin, {
    organizationId: ORG,
    packageId: PKG,
    wakeCondition: "execution_completed",
  })

  if (!recovered) {
    throw new Error("Recovery returned null — research snapshot or lead missing")
  }

  const after = await findAutonomousOutreachPreparationRunByPackageId(admin, ORG, PKG)
  if (!after?.approvalPackage || after.approvalPackage.packageId !== PKG) {
    throw new Error("Post-recovery lookup failed")
  }

  const pkg = after.approvalPackage
  const channels = pkg.generatedAssets.map((a) => a.channel)
  const emailAsset = pkg.generatedAssets.find((a) => a.channel === "email")

  // Confirm Draft Factory pointer unchanged (read-only check)
  const { data: dfRow, error: dfError } = await admin
    .schema("growth")
    .from("draft_factory_lead_states")
    .select("lead_id, state, package_id, version")
    .eq("organization_id", ORG)
    .eq("lead_id", BLOCK)
    .maybeSingle()

  if (dfError) throw new Error(dfError.message)

  console.log(
    JSON.stringify(
      {
        status: "recovered",
        package_id: pkg.packageId,
        company: pkg.companyName,
        asset_channels: channels,
        has_email_preview: Boolean(emailAsset?.preview),
        personalization_evidence_count: pkg.personalizationEvidence.length,
        supporting_research_count: pkg.supportingResearch.length,
        confidence: pkg.confidence,
        pending_human_approval: pkg.pendingHumanApproval,
        transport_blocked: pkg.transportBlocked,
        reused_existing: recovered.reusedExisting,
        draft_factory: {
          state: dfRow?.state ?? null,
          package_id: dfRow?.package_id ?? null,
          version: dfRow?.version ?? null,
          package_id_unchanged: dfRow?.package_id === PKG,
        },
        no_outbound: true,
        no_df_mutation: true,
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
