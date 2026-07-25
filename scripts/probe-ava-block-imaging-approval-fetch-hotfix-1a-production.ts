/**
 * AVA-BLOCK-IMAGING-APPROVAL-FETCH-HOTFIX-1A — Read-only production approval path probe.
 */
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { listGrowthAiCopilotGenerationsForLead } from "../lib/growth/ai-copilot-repository"
import { resolveCanonicalApprovalQueueCount } from "../lib/growth/aios/operator-experience/growth-canonical-operator-workspace-1a"
import {
  buildSupervisedAvaHomeOperatorAttention,
  isReviewableSupervisedAvaGeneration,
  loadSupervisedAvaGenerationsForHome,
  mergeSupervisedAvaIntoApprovalSnapshot,
} from "../lib/growth/ava-reasoning/equipify-supervised-home-projection-1a"
import { buildGrowthHomeWorkspaceSummary } from "../lib/growth/home/growth-home-workspace-summary-service"
import { bootstrapGrowthOperatorNotificationsCertEnv } from "../lib/growth/notifications/growth-notification-cert-bootstrap"
import { getPlatformAdminEmails } from "../lib/platform-admin-policy"

const BLOCK_LEAD_ID = "6d9220f0-2960-468c-b4be-5d7595d292c3" as const
const BLITZ_LEAD_ID = "9ac9c211-f856-4caf-b41b-d8a96e756291" as const
const BASE_URL = "https://app.equipify.ai" as const
const CERT_ID = "ava-block-imaging-approval-fetch-hotfix-1a-v1" as const

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

async function probeHttp(label: string, url: string, cookieHeader: string) {
  const response = await fetch(url, {
    headers: { Cookie: cookieHeader },
    cache: "no-store",
  })
  const text = await response.text()
  let body: unknown = text
  try {
    body = JSON.parse(text)
  } catch {
    // keep text
  }
  console.log(
    JSON.stringify(
      {
        label,
        url,
        status: response.status,
        ok: response.ok,
        body:
          typeof body === "object" && body !== null
            ? body
            : String(body).slice(0, 300),
      },
      null,
      2,
    ),
  )
  return { status: response.status, ok: response.ok, body }
}

async function main(): Promise<void> {
  console.log(`[${CERT_ID}] production approval-path probe`)

  process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN = process.env.EQUIPIFY_VERCEL_PRODUCTION_ENV_RUN ?? "1"
  const cert = bootstrapGrowthOperatorNotificationsCertEnv({ requireVercelProductionEnvRun: false })
  if (!cert?.admin) throw new Error("production_admin_unavailable")

  const summary = await buildGrowthHomeWorkspaceSummary({
    admin: cert.admin,
    operatorEmail: cert.operatorEmail,
    actorUserId: cert.actorUserId,
  })

  const blockPkg =
    summary.canonicalOperatorApproval?.packages.find((row) => row.leadId === BLOCK_LEAD_ID) ??
    (summary.canonicalOperatorApproval?.topPackage?.leadId === BLOCK_LEAD_ID
      ? summary.canonicalOperatorApproval.topPackage
      : null)

  const supervised = summary.supervisedOperatorAttention
  const blockReady = supervised?.readyForReview.find((row) => row.leadId === BLOCK_LEAD_ID) ?? null

  console.log(
    JSON.stringify(
      {
        topPackage: summary.canonicalOperatorApproval?.topPackage,
        blockPkg,
        blockReady,
        focus: summary.canonicalOperatorFocus,
        approvalCount: resolveCanonicalApprovalQueueCount(summary.canonicalOperatorApproval, 0),
      },
      null,
      2,
    ),
  )

  const allGenerations = await listGrowthAiCopilotGenerationsForLead(cert.admin, BLOCK_LEAD_ID, 20)
  const supervisedGenerations = await loadSupervisedAvaGenerationsForHome(cert.admin, [BLOCK_LEAD_ID])
  const reviewable = supervisedGenerations.filter((row) => isReviewableSupervisedAvaGeneration(row))

  console.log(
    JSON.stringify(
      {
        allGenerationCount: allGenerations.length,
        supervisedGenerationCount: supervisedGenerations.length,
        reviewableCount: reviewable.length,
        reviewableSample: reviewable.slice(0, 3).map((row) => ({
          id: row.id,
          status: row.status,
          variant: row.promptVariant,
          subject: row.generatedSubject,
        })),
      },
      null,
      2,
    ),
  )

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!.trim()
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim()
  const cookieHeader = await buildProductionAuthCookieHeader(supabaseUrl, anonKey, serviceRoleKey)

  const generationId = blockReady?.generationId ?? blockPkg?.packageId ?? reviewable[0]?.id ?? null

  if (generationId) {
    const generation = await import("../lib/growth/ai-copilot-repository").then((mod) =>
      mod.fetchGrowthAiCopilotGenerationById(cert.admin, generationId),
    )
    console.log(
      JSON.stringify(
        {
          generationExists: Boolean(generation),
          generationLeadId: generation?.leadId ?? null,
          generationMatchesBlockLead: generation?.leadId === BLOCK_LEAD_ID,
        },
        null,
        2,
      ),
    )
  }

  await probeHttp(
    "block_copilot_generations",
    `${BASE_URL}/api/platform/growth/leads/${BLOCK_LEAD_ID}/copilot/generations`,
    cookieHeader,
  )

  if (generationId) {
    await probeHttp(
      "block_signature_preview",
      `${BASE_URL}/api/platform/growth/copilot/generations/${generationId}/signature-preview`,
      cookieHeader,
    )
    await probeHttp(
      "block_completed_work_package_mismatch",
      `${BASE_URL}/api/platform/growth/ai-os/completed-work/packages/${encodeURIComponent(generationId)}?leadId=${encodeURIComponent(BLOCK_LEAD_ID)}`,
      cookieHeader,
    )
    await probeHttp(
      "block_legacy_package_action_mismatch",
      `${BASE_URL}/api/platform/growth/ai-os/autonomous-outreach-preparation-pilot/packages/${encodeURIComponent(generationId)}/action?leadId=${encodeURIComponent(BLOCK_LEAD_ID)}`,
      cookieHeader,
    )
  }

  const blitzSent = (await loadSupervisedAvaGenerationsForHome(cert.admin, [BLITZ_LEAD_ID])).find(
    (row) => row.sentAt,
  )
  if (blitzSent) {
    await probeHttp(
      "blitz_copilot_generations",
      `${BASE_URL}/api/platform/growth/leads/${BLITZ_LEAD_ID}/copilot/generations`,
      cookieHeader,
    )
    await probeHttp(
      "blitz_signature_preview",
      `${BASE_URL}/api/platform/growth/copilot/generations/${blitzSent.id}/signature-preview`,
      cookieHeader,
    )
  }

  await probeHttp("review_approvals", `${BASE_URL}/api/platform/growth/ai-os/approvals`, cookieHeader)
  await probeHttp("review_command_center", `${BASE_URL}/api/platform/growth/ai-os/command-center`, cookieHeader)

  const clickTarget = blockPkg?.reviewHref ?? blockReady?.reviewHref ?? summary.canonicalOperatorFocus?.href ?? null
  console.log(JSON.stringify({ clickTarget, generationId, packageId: blockPkg?.packageId ?? null }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
