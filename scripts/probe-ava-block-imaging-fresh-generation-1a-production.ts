/**
 * AVA-BLOCK-IMAGING-FRESH-GENERATION-1A — Read-only production audit probe.
 *
 *   pnpm probe:ava-block-imaging-fresh-generation-1a:production
 */

import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import {
  auditSupervisedLeadGenerationState,
  AVA_SUPERVISED_STALE_GENERATION_RECOVERY_1A_QA_MARKER,
  BLOCK_IMAGING_FRESH_GENERATION_LEAD_ID,
  BLOCK_IMAGING_LEGACY_GENERATION_ID,
  isPersistedSupervisedDraftBodyUnsigned,
  PROPOSED_STALE_DRAFT_FRESHNESS_INVARIANT,
} from "../lib/growth/ava-reasoning/ava-supervised-stale-generation-recovery-1a"
import { stripAccidentalAvaSignatureFromBody } from "../lib/growth/ava-reasoning/ava-supervised-outbound-signature-boundary-core"
import { fetchGrowthAiCopilotGenerationById } from "../lib/growth/ai-copilot-repository"
import { loadEquipifyApprovedSenderBundle } from "../lib/growth/ava-reasoning/equipify-approved-sender"
import { resolveOutboundSignatureForSender } from "../lib/growth/signatures/signature-resolver"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "../lib/growth/notifications/growth-notification-cert-bootstrap"
import { getPlatformAdminEmails } from "../lib/platform-admin-policy"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "../lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"

const BASE_URL = "https://app.equipify.ai" as const

async function buildProductionAuthCookieHeader(
  supabaseUrl: string,
  anonKey: string,
  serviceRoleKey: string,
): Promise<string> {
  const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  const email = (getPlatformAdminEmails()[0] ?? "mike@blitzind.com").trim().toLowerCase()
  const link = await adminClient.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: `${BASE_URL}/growth/leads/crm` },
  })
  const hashed = link.data?.properties?.hashed_token
  if (!hashed) throw new Error("generate_link_failed")

  const anon = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } })
  const verified = await anon.auth.verifyOtp({ token_hash: hashed, type: "email" })
  const session = verified.data.session
  if (!session?.access_token || !session.refresh_token) throw new Error("verify_otp_failed")

  const cookiesToSet: Array<{ name: string; value: string }> = []
  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => [],
      setAll: (cookies) => {
        for (const cookie of cookies) cookiesToSet.push({ name: cookie.name, value: cookie.value })
      },
    },
  })
  await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  })

  return cookiesToSet.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ")
}

async function main(): Promise<void> {
  console.log(`[${AVA_SUPERVISED_STALE_GENERATION_RECOVERY_1A_QA_MARKER}] Block Imaging fresh-generation probe`)

  process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN = process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN ?? "1"
  const cert = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: false })
  if (!cert?.admin) throw new Error("production_admin_unavailable")

  const orgId = EQUIPIFY_PRODUCTION_ORG_ID
  const audit = await auditSupervisedLeadGenerationState(cert.admin, {
    organizationId: orgId,
    leadId: BLOCK_IMAGING_FRESH_GENERATION_LEAD_ID,
  })

  const generation = audit.generationId
    ? await fetchGrowthAiCopilotGenerationById(cert.admin, audit.generationId)
    : null

  const senderBundle = await loadEquipifyApprovedSenderBundle(cert.admin, orgId)
  const resolvedSignature = senderBundle.senderAccountId
    ? await resolveOutboundSignatureForSender(cert.admin, { senderAccountId: senderBundle.senderAccountId })
    : null

  const persistedBody = generation?.generatedContent?.trim() ?? ""
  const unsignedBody = persistedBody
    ? stripAccidentalAvaSignatureFromBody(persistedBody, resolvedSignature?.signature?.text ?? null)
    : ""

  console.log(
    JSON.stringify(
      {
        marker: AVA_SUPERVISED_STALE_GENERATION_RECOVERY_1A_QA_MARKER,
        leadId: BLOCK_IMAGING_FRESH_GENERATION_LEAD_ID,
        legacyGenerationId: BLOCK_IMAGING_LEGACY_GENERATION_ID,
        audit,
        persistedBodySample: persistedBody.slice(0, 400),
        persistedBodyTail: persistedBody.slice(-240),
        unsignedBodyTail: unsignedBody.slice(-240),
        persistedBodyUnsigned: isPersistedSupervisedDraftBodyUnsigned(persistedBody),
        previewWouldAppendSignature: Boolean(resolvedSignature?.signature?.text),
        proposedStaleDraftInvariant: PROPOSED_STALE_DRAFT_FRESHNESS_INVARIANT,
      },
      null,
      2,
    ),
  )

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim()
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim()
  const cookieHeader = await buildProductionAuthCookieHeader(supabaseUrl, anonKey, serviceRoleKey)

  if (audit.generationId) {
    const signaturePreview = await fetch(
      `${BASE_URL}/api/platform/growth/copilot/generations/${audit.generationId}/signature-preview`,
      { headers: { Cookie: cookieHeader }, cache: "no-store" },
    )
    const payload = (await signaturePreview.json().catch(() => ({}))) as {
      unsignedBody?: string
      signatureText?: string | null
      previewMode?: string
    }
    console.log(
      JSON.stringify(
        {
          signaturePreviewStatus: signaturePreview.status,
          previewMode: payload.previewMode ?? null,
          unsignedBodyTail: payload.unsignedBody?.slice(-240) ?? null,
          signatureTextPresent: Boolean(payload.signatureText?.trim()),
          homePreviewWouldHaveAppendedSignature: Boolean(payload.signatureText?.trim()),
        },
        null,
        2,
      ),
    )
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
