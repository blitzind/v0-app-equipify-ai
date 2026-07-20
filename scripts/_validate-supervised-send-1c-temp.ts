/**
 * GE-AIOS-FIRST-CUSTOMER-SUPERVISED-SEND-RUNTIME-VALIDATION-1C — read-only production audit.
 */
import { execSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { chromium } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { mintGrowthPlatformAdminBearerToken } from "@/lib/growth/qa/growth-platform-admin-bearer-probe"
import { resolveSupabaseUrlForProjectRef } from "@/lib/growth/qa/supabase-cli-linked-project-bootstrap"
import { EQUIPIFY_PRODUCTION_ORG_ID } from "@/lib/growth/live-operations/ge-aios-live-1b-equipify-company-profile-content"
import {
  GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_EVENT,
  GROWTH_AVA_OUTREACH_PACKAGE_APPROVAL_EVENT,
} from "@/lib/growth/mission-center/growth-ava-outreach-execution-request-types"
import { buildAvaOperatorPackageActionApiPath } from "@/lib/growth/mission-center/growth-ava-operator-workspace-contract"

const LEAD_ID = "6d9220f0-2960-468c-b4be-5d7595d292c3"
const PACKAGE_ID = "outreach-prep:6d9220f0-2960-468c-b4be-5d7595d292c3:2026-07-16T00:20:44.387Z"
const BASE_URL = "https://app.equipify.ai"

function bootstrap() {
  const projectRef = readFileSync(resolve(process.cwd(), "supabase/.temp/project-ref"), "utf8").trim()
  const url = resolveSupabaseUrlForProjectRef(projectRef)
  const keysRaw = execSync(`supabase projects api-keys --project-ref ${projectRef} -o json`, { encoding: "utf8" })
  const keys = JSON.parse(keysRaw) as Array<{ name: string; api_key: string }>
  const service_role_key = keys.find((k) => k.name === "service_role")!.api_key
  const anon_key = keys.find((k) => k.name === "anon")!.api_key
  const admin = createClient(url, service_role_key, { auth: { persistSession: false } })
  return { url, service_role_key, anon_key, admin }
}

async function mintBearer(): Promise<string> {
  const { url, service_role_key, anon_key } = bootstrap()
  const minted = await mintGrowthPlatformAdminBearerToken({
    supabase_url: url,
    service_role_key,
    anon_key,
    admin_email: "mike@blitzind.com",
  })
  if (!minted.access_token) throw new Error(minted.error ?? "mint_failed")
  return minted.access_token
}

async function authCookies() {
  const { url, service_role_key, anon_key } = bootstrap()
  const admin = createClient(url, service_role_key, { auth: { persistSession: false } })
  const link = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: "mike@blitzind.com",
    options: { redirectTo: `${BASE_URL}/growth/os/approvals` },
  })
  const hashed = link.data?.properties?.hashed_token
  if (!hashed) throw new Error("generate_link_failed")
  const anon = createClient(url, anon_key, { auth: { persistSession: false } })
  const verified = await anon.auth.verifyOtp({ token_hash: hashed, type: "email" })
  const session = verified.data.session
  if (!session?.access_token || !session.refresh_token) throw new Error("verify_otp_failed")
  const cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }> = []
  const supabase = createServerClient(url, anon_key, {
    cookies: { getAll: () => [], setAll: (c) => { for (const x of c) cookiesToSet.push(x) } },
  })
  await supabase.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token })
  return cookiesToSet.map((cookie) => ({
    name: cookie.name,
    value: cookie.value,
    domain: new URL(BASE_URL).hostname,
    path: "/",
    httpOnly: Boolean(cookie.options?.httpOnly),
    secure: true,
    sameSite: "Lax" as const,
  }))
}

async function main(): Promise<void> {
  const report: Record<string, unknown> = {
    milestone: "GE-AIOS-FIRST-CUSTOMER-SUPERVISED-SEND-RUNTIME-VALIDATION-1C",
    timestamp: new Date().toISOString(),
    leadId: LEAD_ID,
    packageId: PACKAGE_ID,
  }

  // Phase 1 — deployment
  const inspectRaw = execSync("vercel inspect app.equipify.ai --json 2>/dev/null", { encoding: "utf8" })
  const deployment = JSON.parse(inspectRaw) as {
    id: string
    readyState: string
    url: string
    createdAt: number
  }
  report.phase1_deployment = {
    deploymentId: deployment.id,
    status: deployment.readyState,
    readyTimestamp: new Date(deployment.createdAt).toISOString(),
    productionUrl: "https://app.equipify.ai",
    deploymentUrl: deployment.url,
  }

  const { admin } = bootstrap()
  const token = await mintBearer()
  const actionPath = buildAvaOperatorPackageActionApiPath(PACKAGE_ID)
  const packageApiPath = `/api/platform/growth/ai-os/completed-work/packages/${encodeURIComponent(PACKAGE_ID)}?leadId=${encodeURIComponent(LEAD_ID)}`

  // Phase 3/4 — live GET APIs (read-only)
  const [actionGet, packageGet] = await Promise.all([
    fetch(`${BASE_URL}${actionPath}?leadId=${encodeURIComponent(LEAD_ID)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }),
    fetch(`${BASE_URL}${packageApiPath}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }),
  ])
  const actionBody = await actionGet.json()
  const packageBody = await packageGet.json()

  report.phase3_live_api = {
    route: actionPath,
    method: "GET",
    httpStatus: actionGet.status,
    xVercelId: actionGet.headers.get("x-vercel-id"),
    responseBody: actionBody,
    responseTimestamp: new Date().toISOString(),
  }

  const pkg = (packageBody as { package?: Record<string, unknown> }).package ?? null
  report.phase4_approval_persistence = {
    packageApiStatus: packageGet.status,
    packageApprovalDecision: pkg?.packageApprovalDecision ?? null,
    pendingHumanApproval: pkg?.pendingHumanApproval ?? null,
    transportBlocked: pkg?.transportBlocked ?? null,
    approvedAt: pkg?.approvedAt ?? pkg?.packageApprovedAt ?? null,
    executionRequestId: pkg?.executionRequestId ?? null,
    operatorApprovedAssetsFingerprint: (pkg?.operatorApprovedAssets as { fingerprint?: string } | null)?.fingerprint ?? null,
    frozenAt: (pkg?.operatorApprovedAssets as { frozenAt?: string } | null)?.frozenAt ?? null,
  }

  report.phase5_execution_request = actionBody.executionRequest ?? null

  // Frozen assets from DB run record
  const { data: runs } = await admin
    .schema("growth")
    .from("ava_outreach_preparation_pilot_runs")
    .select("run_id, lead_id, approval_package, updated_at")
    .eq("organization_id", EQUIPIFY_PRODUCTION_ORG_ID)
    .eq("lead_id", LEAD_ID)
    .order("updated_at", { ascending: false })
    .limit(5)

  const targetRun = (runs ?? []).find((r) => {
    const ap = r.approval_package as { packageId?: string } | null
    return ap?.packageId === PACKAGE_ID
  })
  const approvalPkg = targetRun?.approval_package as Record<string, unknown> | null

  report.phase6_frozen_assets = {
    runId: targetRun?.run_id ?? null,
    packageApprovalDecision: approvalPkg?.packageApprovalDecision ?? null,
    pendingHumanApproval: approvalPkg?.pendingHumanApproval ?? null,
    transportBlocked: approvalPkg?.transportBlocked ?? null,
    operatorApprovedAssets: approvalPkg?.operatorApprovedAssets ?? null,
    channels: approvalPkg?.channels ?? null,
    recommendedChannel: approvalPkg?.recommendedChannel ?? null,
    preparedAt: approvalPkg?.preparedAt ?? null,
    updatedAt: targetRun?.updated_at ?? null,
  }

  // Phase 7 — audit events
  const { data: events } = await admin
    .schema("growth")
    .from("ai_os_events")
    .select("id, event_type, occurred_at, correlation_id, entity_id, payload, producer")
    .eq("organization_id", EQUIPIFY_PRODUCTION_ORG_ID)
    .in("event_type", [GROWTH_AVA_OUTREACH_PACKAGE_APPROVAL_EVENT, GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_EVENT])
    .order("occurred_at", { ascending: false })
    .limit(50)

  const correlated = (events ?? []).filter((e) => {
    const p = e.payload as { package_id?: string; lead_id?: string } | null
    return p?.package_id === PACKAGE_ID || p?.lead_id === LEAD_ID || e.entity_id === LEAD_ID || e.correlation_id === PACKAGE_ID
  })

  report.phase7_audit_events = {
    packageApprovalEvents: correlated.filter((e) => e.event_type === GROWTH_AVA_OUTREACH_PACKAGE_APPROVAL_EVENT),
    executionRequestEvents: correlated.filter((e) => e.event_type === GROWTH_AVA_OUTREACH_EXECUTION_REQUEST_EVENT),
  }

  // Phase 8 — sequence jobs
  const execReq = actionBody.executionRequest as { sequenceJobId?: string | null; sequenceEnrollmentId?: string | null; executionStatus?: string; recommendedChannel?: string } | null
  let sequenceJob = null
  let enrollment = null
  if (execReq?.sequenceJobId) {
    const { data: job } = await admin
      .schema("growth")
      .from("sequence_execution_jobs")
      .select("*")
      .eq("id", execReq.sequenceJobId)
      .maybeSingle()
    sequenceJob = job
  }
  if (execReq?.sequenceEnrollmentId) {
    const { data: enr } = await admin
      .schema("growth")
      .from("sequence_enrollments")
      .select("id, status, sequence_id, lead_id, metadata")
      .eq("id", execReq.sequenceEnrollmentId)
      .maybeSingle()
    enrollment = enr
  }
  report.phase8_sequence_handoff = {
    recommendedChannel: execReq?.recommendedChannel ?? null,
    executionStatus: execReq?.executionStatus ?? null,
    sequenceJobId: execReq?.sequenceJobId ?? null,
    sequenceEnrollmentId: execReq?.sequenceEnrollmentId ?? null,
    sequenceJob,
    enrollment,
  }

  // Phase 9 — outbound safety + kill switch
  const { data: killRow } = await admin
    .schema("growth")
    .from("autonomy_kill_switches")
    .select("autonomy_outbound_enabled")
    .eq("organization_id", EQUIPIFY_PRODUCTION_ORG_ID)
    .maybeSingle()

  const outboundTables = [
    ["outbound_messages", "channel"],
    ["linkedin_outbound_messages", "id"],
    ["sms_outbound_messages", "id"],
    ["voice_ai_outbound_sessions", "id"],
  ] as const
  const outboundCounts: Record<string, number> = {}
  for (const [table] of outboundTables) {
    const { count } = await admin.schema("growth").from(table).select("id", { count: "exact", head: true }).eq("lead_id", LEAD_ID)
    outboundCounts[table] = count ?? 0
  }
  const { count: orgOutbound } = await admin.schema("growth").from("outbound_messages").select("id", { count: "exact", head: true }).eq("organization_id", EQUIPIFY_PRODUCTION_ORG_ID)

  report.phase9_outbound_safety = {
    autonomy_outbound_enabled: killRow?.autonomy_outbound_enabled ?? null,
    leadScopedCounts: outboundCounts,
    orgOutboundMessages: orgOutbound ?? 0,
  }

  // Lead metadata execution requests (canonical ledger)
  const { data: leadRow } = await admin.schema("growth").from("leads").select("id, metadata").eq("id", LEAD_ID).maybeSingle()
  const metadata = (leadRow?.metadata ?? {}) as Record<string, unknown>
  report.lead_metadata_execution_requests = metadata.ava_outreach_execution_requests ?? null

  // Phase 2 + 10 — UI state (no Authorize click)
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  await page.context().addCookies(await authCookies())
  const pageRes = await page.goto(`${BASE_URL}/growth/os/approvals`, { waitUntil: "networkidle", timeout: 120000 })
  await page.waitForTimeout(8000)
  const bodyText = await page.locator("body").innerText()
  const authorizeButtons = await page.getByRole("button", { name: /Authorize/i }).count()
  const approvedText = bodyText.match(/approved|Authorized|execution request|Package approved|Sequence transport/i) ?? []
  report.phase2_operator_visible = {
    pageHttpStatus: pageRes?.status() ?? null,
    routeError: bodyText.includes("We couldn't load this screen"),
    blockImagingVisible: /block imaging/i.test(bodyText),
    authorizeButtonCount: authorizeButtons,
    matchedStatusPhrases: approvedText,
    bodySnippet: bodyText.slice(0, 2000),
  }

  // Idempotency: refresh
  await page.reload({ waitUntil: "networkidle" })
  await page.waitForTimeout(5000)
  const bodyAfterRefresh = await page.locator("body").innerText()
  const authorizeAfterRefresh = await page.getByRole("button", { name: /Authorize/i }).count()
  report.phase10_idempotency = {
    authorizeButtonCountAfterRefresh: authorizeAfterRefresh,
    duplicateAuthorizeVisible: authorizeAfterRefresh > 0,
    bodySnippetAfterRefresh: bodyAfterRefresh.slice(0, 1200),
  }
  await browser.close()

  // Vercel logs for POST authorize
  try {
    const logsRaw = execSync("vercel logs app.equipify.ai --json 2>/dev/null", { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 })
    const postLogs = []
    for (const line of logsRaw.split("\n")) {
      if (!line.trim()) continue
      try {
        const row = JSON.parse(line) as { requestMethod?: string; requestPath?: string; responseStatusCode?: number; message?: string; timestamp?: number }
        const path = row.requestPath ?? ""
        if (path.includes("autonomous-outreach-preparation-pilot") && path.includes("action") && row.requestMethod === "POST") {
          postLogs.push(row)
        }
      } catch { /* skip */ }
    }
    report.vercel_post_authorize_logs = postLogs.slice(0, 5)
  } catch {
    report.vercel_post_authorize_logs = []
  }

  console.log(JSON.stringify(report, null, 2))
}

void main()
