/**
 * Phase 15.3A — read-only touch-type and cohort probe (temporary debug).
 */
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

const HENRY = "7bf7a767-ef0f-4441-af6e-d0f3ffa81d56"
const COHORT = "c04a1a26-9e22-4aa7-b1b3-025ffdfc591a"

async function main(): Promise<void> {
  const boot = bootstrapVerifiedChannelsCertEnv({
    sources: [".env.vercel.production", ".vercel/.env.production.local", ".env.production.local", ".env.local.rebuild"],
    inheritProcessEnvProviderKeys: true,
    protectedSnapshot: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      SUPABASE_URL: process.env.SUPABASE_URL ?? "",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    },
  })
  if (!boot) {
    console.log(JSON.stringify({ error: "no boot" }))
    process.exit(1)
  }

  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })

  const touchTypes = ["email_send", "reply", "meeting", "opportunity_created", "opportunity_won"] as const
  const counts: Record<string, number> = {}
  for (const t of touchTypes) {
    const { count } = await admin
      .schema("growth")
      .from("attribution_touches")
      .select("id", { count: "exact", head: true })
      .eq("touch_type", t)
    counts[t] = count ?? 0
  }

  const { data: byType } = await admin.schema("growth").from("attribution_touches").select("touch_type").limit(100)
  const typeDist: Record<string, number> = {}
  for (const row of byType ?? []) {
    const t = String((row as { touch_type: string }).touch_type)
    typeDist[t] = (typeDist[t] ?? 0) + 1
  }

  const { data: henryTouches } = await admin
    .schema("growth")
    .from("attribution_touches")
    .select("touch_type,touched_at,attribution_source")
    .eq("lead_id", HENRY)
    .order("touched_at")

  const { data: henryReply } = await admin
    .schema("growth")
    .from("outbound_replies")
    .select("id,classification,intent,sentiment,received_at")
    .eq("lead_id", HENRY)
    .limit(5)

  const { data: legacyMeetings } = await admin
    .schema("growth")
    .from("meetings")
    .select("id,lead_id,status,scheduled_at")
    .eq("lead_id", HENRY)
    .limit(5)

  const { data: cohortCompanies } = await admin
    .schema("growth")
    .from("apollo_pilot_cohort_companies")
    .select("company_candidate_id")
    .eq("cohort_id", COHORT)

  const companyIds =
    cohortCompanies?.map((row) => String((row as { company_candidate_id: string }).company_candidate_id)).filter(Boolean) ??
    []

  const { data: cohortLeads } = companyIds.length
    ? await admin.schema("growth").from("leads").select("id,company_candidate_id").in("company_candidate_id", companyIds).limit(500)
    : { data: [] }

  const { data: enrollments } = await admin
    .schema("growth")
    .from("sequence_enrollments")
    .select("lead_id")
    .eq("cohort_id", COHORT)
    .limit(500)

  const enrollLeadIds = [...new Set((enrollments ?? []).map((row) => String((row as { lead_id: string }).lead_id)).filter(Boolean))]

  const { count: meetingTimelineEvents } = await admin
    .schema("growth")
    .from("lead_timeline_events")
    .select("id", { count: "exact", head: true })
    .in("event_type", [
      "meeting_scheduled",
      "meeting_completed",
      "meeting_canceled",
      "meeting_no_show",
      "meeting_outcome_recorded",
      "meeting_followup_due",
    ])

  const { data: meetingIntentReplies } = await admin
    .schema("growth")
    .from("outbound_replies")
    .select("id,lead_id,classification,intent")
    .or("classification.eq.meeting_request,intent.eq.meeting_request")
    .limit(10)

  console.log(
    JSON.stringify(
      {
        touch_type_counts: counts,
        touch_type_distribution_sample: typeDist,
        henry: { touches: henryTouches, replies: henryReply, legacy_meetings: legacyMeetings },
        cohort: {
          companies: companyIds.length,
          leads_via_company: cohortLeads?.length ?? 0,
          leads_via_enrollment: enrollLeadIds.length,
        },
        meeting_timeline_events: meetingTimelineEvents ?? 0,
        meeting_intent_replies_sample: meetingIntentReplies ?? [],
      },
      null,
      2,
    ),
  )
}

main().catch((error) => {
  console.error(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
  process.exit(1)
})
