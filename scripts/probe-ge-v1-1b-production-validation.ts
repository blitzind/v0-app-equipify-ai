/**
 * GE-v1-1B — read-only production validation probe (no sends, no approvals).
 *
 * Run:
 *   node -r ./scripts/server-only-shim.cjs --import tsx scripts/vercel-production-env-run.ts -- \
 *     node -r ./scripts/server-only-shim.cjs --import tsx scripts/probe-ge-v1-1b-production-validation.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"
import { isGrowthSenderProfilesSchemaReady } from "../lib/growth/signatures/sender-profile-schema-health"
import {
  GE_V1_1_EQUIPIFY_DEMO_PAGE_TITLE,
  GE_V1_1_MEDICAL_AUDIENCE_NAME,
  GE_V1_1_MEDICAL_ICP_NAMING_PREFIX,
  GE_V1_1_MEDICAL_SAVED_SEARCHES,
} from "../lib/growth/operational/ge-v1-1-medical-icp-kit"
import { getSendrLaunchWorkspaceSummary } from "../lib/growth/sendr/growth-sendr-launch-workspace-service"

export const GE_V1_1B_PROBE_QA_MARKER = "ge-v1-1b-production-validation-v1" as const

const OPERATOR_ORG_ID = process.env.GE_V1_1_ORG_ID?.trim() || "5876176a-61ec-4532-ad99-0c31482d5a91"
const APP_BASE = (
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  (process.env.VERCEL_URL?.trim() ? `https://${process.env.VERCEL_URL.trim()}` : "") ||
  "https://app.equipify.ai"
).replace(/\/$/, "")

const PRODUCTION_ENV_SOURCES = [
  ".env.vercel.production",
  ".vercel/.env.production.local",
  ".env.production.local",
  ".env.local.rebuild",
] as const

const OPERATOR_ROUTES = [
  "/growth/runbook",
  "/growth/leads/prospect-search",
  "/growth/audiences",
  "/growth/videos/personalized/launch",
  "/growth/campaigns/sequences",
  "/growth/engagement",
  "/growth/settings/signatures",
] as const

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

async function probeHttpRoute(pathname: string): Promise<{
  path: string
  status: number
  ok: boolean
  note: string
}> {
  const url = `${APP_BASE}${pathname}`
  try {
    const res = await fetch(url, { redirect: "manual", headers: { Accept: "text/html" } })
    const status = res.status
    const ok = status === 200 || status === 307 || status === 308 || status === 302 || status === 301
    const note =
      status === 200
        ? "page HTML returned"
        : status >= 300 && status < 400
          ? `redirect (${res.headers.get("location") ?? "login?"})`
          : status >= 500
            ? "server error"
            : `HTTP ${status}`
    return { path: pathname, status, ok, note }
  } catch (error) {
    return {
      path: pathname,
      status: 0,
      ok: false,
      note: error instanceof Error ? error.message : "fetch_failed",
    }
  }
}

async function checkMigration(admin: SupabaseClient) {
  const ready = await isGrowthSenderProfilesSchemaReady(admin)
  let tableExists = false
  let rowCount: number | null = null
  if (ready) {
    const { count, error } = await admin
      .schema("growth")
      .from("sender_profiles")
      .select("id", { count: "exact", head: true })
    tableExists = !error
    rowCount = error ? null : count ?? 0
  }
  return {
    migration_file: "20270922120000_growth_sender_profiles_foundation.sql",
    schema_ready: ready,
    table_query_ok: tableExists,
    sender_profile_count: rowCount,
    applied: ready && tableExists,
  }
}

async function checkSeedState(admin: SupabaseClient, orgId: string) {
  const expectedNames = GE_V1_1_MEDICAL_SAVED_SEARCHES.map((s) => s.name)

  const { data: savedSearches } = await admin
    .schema("growth")
    .from("prospect_search_saved_searches")
    .select("id, name, query_text, metadata")
    .in("name", expectedNames)

  const { data: audiences } = await admin
    .schema("growth")
    .from("growth_audiences")
    .select("id, name, last_snapshot_id, organization_id")
    .eq("organization_id", orgId)
    .eq("name", GE_V1_1_MEDICAL_AUDIENCE_NAME)

  const audience = audiences?.[0] ?? null
  let snapshotMemberCount: number | null = null
  if (audience?.last_snapshot_id) {
    const { data: snap } = await admin
      .schema("growth")
      .from("growth_audience_snapshots")
      .select("member_count")
      .eq("id", audience.last_snapshot_id)
      .maybeSingle()
    snapshotMemberCount = snap?.member_count != null ? Number(snap.member_count) : null
  }

  const { data: pages } = await admin
    .schema("growth")
    .from("growth_landing_pages")
    .select("id, title, status, published_slug, slug, variable_map")
    .eq("organization_id", orgId)
    .eq("title", GE_V1_1_EQUIPIFY_DEMO_PAGE_TITLE)
    .is("deleted_at", null)

  const page = pages?.[0] ?? null
  let calendarHref: string | null = null
  if (page?.id) {
    const { data: sections } = await admin
      .schema("growth")
      .from("growth_landing_page_sections")
      .select("section_type, content")
      .eq("landing_page_id", page.id)
      .in("section_type", ["calendar", "cta"])
    for (const section of sections ?? []) {
      const content = section.content as Record<string, unknown> | null
      const href = asString(content?.href)
      if (section.section_type === "calendar" || href.includes("equipify-demo") || href.includes("meeting_link")) {
        calendarHref = href || calendarHref
      }
    }
  }

  const foundSearchNames = (savedSearches ?? []).map((r) => asString(r.name))
  const missingSearches = expectedNames.filter((n) => !foundSearchNames.includes(n))

  return {
    medical_saved_searches: {
      expected: expectedNames.length,
      found: foundSearchNames.length,
      missing: missingSearches,
      rows: (savedSearches ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        kit: (r.metadata as Record<string, unknown> | null)?.ge_v1_1_kit ?? null,
      })),
    },
    medical_audience: audience
      ? {
          id: audience.id,
          name: audience.name,
          last_snapshot_id: audience.last_snapshot_id,
          snapshot_member_count: snapshotMemberCount,
        }
      : null,
    equipify_demo_page: page
      ? {
          id: page.id,
          status: page.status,
          published_slug: page.published_slug ?? page.slug,
          public_url: page.published_slug || page.slug ? `${APP_BASE}/videos/${page.published_slug ?? page.slug}` : null,
          meeting_link: (page.variable_map as Record<string, unknown> | null)?.meeting_link ?? null,
          calendar_section_href: calendarHref,
        }
      : null,
    seed_complete:
      missingSearches.length === 0 &&
      audience != null &&
      audience.last_snapshot_id != null &&
      page?.status === "published",
  }
}

async function checkSenderProfiles(admin: SupabaseClient) {
  const { data: senders } = await admin
    .schema("growth")
    .from("sender_accounts")
    .select("id, email_address, display_name, status")
    .order("created_at", { ascending: true })

  const { data: mailboxes } = await admin
    .schema("growth")
    .from("mailbox_connections")
    .select("id, sender_account_id, email_address, status, send_allowed")
    .order("created_at", { ascending: true })

  const { data: profiles } = await admin
    .schema("growth")
    .from("sender_profiles")
    .select("id, sender_account_id, mailbox_connection_id, display_name, email, active, signature_template")
    .is("deleted_at", null)

  const profileBySender = new Map((profiles ?? []).map((p) => [asString(p.sender_account_id), p]))
  const connectedMailboxes = (mailboxes ?? []).filter((m) => {
    const status = asString(m.status)
    return status === "connected" || status === "active" || status === "warming"
  })

  const unassigned = connectedMailboxes
    .filter((m) => {
      const profile = profileBySender.get(asString(m.sender_account_id))
      return !profile?.active
    })
    .map((m) => ({
      mailbox_id: m.id,
      sender_account_id: m.sender_account_id,
      email: m.email_address,
      status: m.status,
    }))

  return {
    sender_account_count: senders?.length ?? 0,
    mailbox_connection_count: mailboxes?.length ?? 0,
    connected_mailbox_count: connectedMailboxes.length,
    mailbox_status_breakdown: (mailboxes ?? []).reduce<Record<string, number>>((acc, m) => {
      const key = asString(m.status) || "unknown"
      acc[key] = (acc[key] ?? 0) + 1
      return acc
    }, {}),
    sender_profile_count: profiles?.length ?? 0,
    active_sender_profile_count: (profiles ?? []).filter((p) => p.active).length,
    unassigned_connected_mailboxes: unassigned,
    sender_accounts: (senders ?? []).map((s) => ({
      id: s.id,
      email: s.email_address,
      display_name: s.display_name,
      status: s.status,
      has_active_profile: profileBySender.get(asString(s.id))?.active === true,
    })),
  }
}

async function checkLaunchDryRun(admin: SupabaseClient, orgId: string) {
  const killRes = await admin
    .schema("growth")
    .from("runtime_guardrail_settings")
    .select("key, enabled")
    .in("key", ["sendr_launch_enabled", "audience_enrollment_enabled"])

  const summary = await getSendrLaunchWorkspaceSummary(admin, { organizationId: orgId }).catch((error) => ({
    error: error instanceof Error ? error.message : String(error),
  }))

  const audiencesWithSnapshot =
    typeof summary === "object" && summary != null && "audiences" in summary
      ? summary.audiences.filter((a) => a.lastSnapshotId)
      : []

  const publishedPages =
    typeof summary === "object" && summary != null && "publishedPages" in summary ? summary.publishedPages : []

  const senderProfiles =
    typeof summary === "object" && summary != null && "senderProfiles" in summary
      ? summary.senderProfiles
      : []

  return {
    kill_switches: killRes.data ?? [],
    launch_summary_error: typeof summary === "object" && summary != null && "error" in summary ? summary.error : null,
    audiences_total: typeof summary === "object" && summary != null && "audiences" in summary ? summary.audiences.length : 0,
    audiences_with_snapshot: audiencesWithSnapshot.length,
    published_pages: publishedPages.length,
    sequence_patterns:
      typeof summary === "object" && summary != null && "sequencePatterns" in summary
        ? summary.sequencePatterns.length
        : 0,
    sender_profiles_in_launch_summary: senderProfiles.length,
    dry_run_ready:
      !("error" in (summary as object)) &&
      audiencesWithSnapshot.length > 0 &&
      publishedPages.length > 0 &&
      (typeof summary === "object" &&
        summary != null &&
        "sequencePatterns" in summary &&
        summary.sequencePatterns.length > 0),
    operator_ui_steps: [
      "Open /growth/videos/personalized/launch",
      "Select audience with snapshot (Medical Equipment ICP)",
      "Select sequence pattern",
      "Select sender profile (or configure in Settings → Signatures first)",
      "Select published Equipify Demo page",
      "Preview → Confirm enrollment (creates draft enrollments, no sends)",
      "Review pending jobs at /growth/campaigns/sequences",
    ],
  }
}

async function checkApprovalBacklog(admin: SupabaseClient) {
  const { data: jobs } = await admin
    .schema("growth")
    .from("sequence_execution_jobs")
    .select(
      "id, status, created_at, updated_at, lead_id, sequence_enrollment_id, sender_account_id, scheduled_for, last_error",
    )
    .eq("status", "pending_approval")
    .order("created_at", { ascending: true })

  const enrollmentIds = [...new Set((jobs ?? []).map((j) => asString(j.sequence_enrollment_id)).filter(Boolean))]
  const leadIds = [...new Set((jobs ?? []).map((j) => asString(j.lead_id)).filter(Boolean))]

  const { data: enrollments } = enrollmentIds.length
    ? await admin
        .schema("growth")
        .from("sequence_enrollments")
        .select("id, sequence_pattern_id, status, created_at")
        .in("id", enrollmentIds)
    : { data: [] as Array<Record<string, unknown>> }

  const { data: patterns } = await admin.schema("growth").from("sequence_patterns").select("id, label")

  const patternLabel = new Map((patterns ?? []).map((p) => [asString(p.id), asString(p.label)]))
  const enrollmentById = new Map((enrollments ?? []).map((e) => [asString(e.id), e]))

  const now = Date.now()
  const rows = (jobs ?? []).map((job) => {
    const created = new Date(asString(job.created_at)).getTime()
    const ageDays = Number.isFinite(created) ? Math.round((now - created) / 86400000) : null
    const enrollment = enrollmentById.get(asString(job.sequence_enrollment_id))
    return {
      job_id: job.id,
      age_days: ageDays,
      created_at: job.created_at,
      sequence_pattern: enrollment
        ? patternLabel.get(asString(enrollment.sequence_pattern_id)) ?? enrollment.sequence_pattern_id
        : null,
      enrollment_status: enrollment?.status ?? null,
      sender_account_id: job.sender_account_id,
      lead_id: job.lead_id,
      scheduled_for: job.scheduled_for,
      last_error: job.last_error,
    }
  })

  return {
    pending_approval_count: rows.length,
    unique_leads: leadIds.length,
    jobs: rows,
    stale_over_14_days: rows.filter((r) => (r.age_days ?? 0) >= 14).length,
  }
}

async function main(): Promise<void> {
  const boot = bootstrapVerifiedChannelsCertEnv({
    sources: PRODUCTION_ENV_SOURCES,
    inheritProcessEnvProviderKeys: true,
    protectedSnapshot: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      SUPABASE_URL: process.env.SUPABASE_URL ?? "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    },
  })

  if (!boot) {
    console.log(JSON.stringify({ ok: false, error: "supabase_unavailable", qa_marker: GE_V1_1B_PROBE_QA_MARKER }, null, 2))
    process.exit(1)
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false, autoRefreshToken: false } })

  const [migration, seed, senders, launch, backlog, routes] = await Promise.all([
    checkMigration(admin),
    checkSeedState(admin, OPERATOR_ORG_ID),
    checkSenderProfiles(admin),
    checkLaunchDryRun(admin, OPERATOR_ORG_ID),
    checkApprovalBacklog(admin),
    Promise.all(OPERATOR_ROUTES.map((path) => probeHttpRoute(path))),
  ])

  const report = {
    ok: true,
    qa_marker: GE_V1_1B_PROBE_QA_MARKER,
    operator_org_id: OPERATOR_ORG_ID,
    app_base: APP_BASE,
    migration,
    seed,
    senders,
    launch_dry_run: launch,
    approval_backlog: backlog,
    route_smoke_tests: routes,
    route_smoke_ok: routes.every((r) => r.ok),
  }

  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2))
  process.exit(1)
})
