/**
 * SV1-5A — SQL-backed reconcile for Equipify Growth test org via linked Supabase CLI.
 * Prefer this when Vercel encrypted service-role secrets are unavailable locally.
 *
 * Dry-run (default):
 *   pnpm reconcile:sv1-5a-draft-factory-states-production
 *
 * Apply:
 *   pnpm reconcile:sv1-5a-draft-factory-states-production -- --apply
 *
 * Never uses .env.local. No paid provider wakes. No app deploy.
 */
import { execFileSync } from "node:child_process"

/** Canonical Equipify Growth test organization. */
const ORG = "5876176a-61ec-4532-ad99-0c31482d5a91" as const

function runQuery(sql: string): string {
  return execFileSync("supabase", ["db", "query", "--linked", sql], {
    cwd: process.cwd(),
    encoding: "utf8",
  })
}

function extractRows(output: string): Array<Record<string, unknown>> {
  try {
    const json = JSON.parse(output.replace(/^[\s\S]*?(\{[\s\S]*\})\s*$/, "$1"))
    return (json.rows as Array<Record<string, unknown>>) ?? []
  } catch {
    const match = output.match(/\{[\s\S]*"rows"[\s\S]*\}/)
    if (!match) return []
    try {
      return (JSON.parse(match[0]).rows as Array<Record<string, unknown>>) ?? []
    } catch {
      return []
    }
  }
}

function main(): void {
  const apply = process.argv.includes("--apply")
  console.log(`[SV1-5A] Reconcile Draft Factory states (linked SQL)`)
  console.log(`Mode: ${apply ? "APPLY" : "DRY-RUN"}`)
  console.log(`Organization: ${ORG}`)
  console.log(`Note: growth.leads is Growth-Engine scoped; organization_id is stamped on DF rows only.`)

  const inspected = extractRows(
    runQuery(`
with lead_base as (
  select
    l.id as lead_id,
    l.latest_prospect_research_run_id,
    l.last_prospect_researched_at,
    l.primary_decision_maker_id,
    l.decision_maker_status,
    coalesce((l.metadata->>'admission_state'), 'unknown') as admission_state
  from growth.leads l
),
classified as (
  select
    lead_id,
    case
      when admission_state in ('rejected', 'invalid') then 'failed'
      when latest_prospect_research_run_id is null or last_prospect_researched_at is null then 'waiting_for_research'
      when primary_decision_maker_id is null
        and coalesce(decision_maker_status, '') not in ('confirmed', 'verified_contactable', 'suspected')
        then 'waiting_for_dm'
      when coalesce(decision_maker_status, '') not in ('confirmed', 'verified_contactable')
        then 'waiting_for_contact_verification'
      else 'waiting_for_generation'
    end as projected_state,
    case
      when latest_prospect_research_run_id is null or last_prospect_researched_at is null then 'research'
      when primary_decision_maker_id is null
        and coalesce(decision_maker_status, '') not in ('confirmed', 'verified_contactable', 'suspected')
        then 'decision_maker'
      when coalesce(decision_maker_status, '') not in ('confirmed', 'verified_contactable')
        then 'contact_verification'
      else 'generation'
    end as projected_stage,
    latest_prospect_research_run_id::text as research_run_id,
    primary_decision_maker_id::text as decision_maker_id
  from lead_base
)
select
  (select count(*)::int from lead_base) as total_leads_inspected,
  (select count(*)::int from growth.draft_factory_lead_states where organization_id = '${ORG}') as rows_already_present,
  count(*) filter (where projected_state = 'waiting_for_research')::int as waiting_for_research,
  count(*) filter (where projected_state = 'waiting_for_dm')::int as waiting_for_dm,
  count(*) filter (where projected_state = 'waiting_for_contact_verification')::int as waiting_for_contact_verification,
  count(*) filter (where projected_state = 'waiting_for_personalization')::int as waiting_for_personalization,
  count(*) filter (where projected_state = 'waiting_for_generation')::int as waiting_for_generation,
  count(*) filter (where projected_state = 'waiting_for_approval')::int as waiting_for_approval,
  count(*) filter (where projected_state = 'failed')::int as failed,
  0::int as stopped,
  count(*) filter (where projected_stage in ('portfolio', 'generation') and projected_state = 'waiting_for_generation')::int as deferred
from classified;
`),
  )[0]

  console.log("\n--- Dry-run projection ---")
  console.log(JSON.stringify(inspected, null, 2))

  if (!apply) {
    console.log("\nDry-run complete — no rows written.")
    console.log("Re-run with --apply to upsert missing DF rows (no paid wakes).")
    return
  }

  console.log("\n--- Applying non-destructive upserts for missing leads ---")
  runQuery(`
insert into growth.draft_factory_lead_states (
  organization_id,
  lead_id,
  state,
  earliest_incomplete_stage,
  version,
  research_run_id,
  decision_maker_id,
  attempt_counts,
  paused_reason,
  created_at,
  updated_at
)
select
  '${ORG}'::uuid,
  c.lead_id,
  c.projected_state,
  c.projected_stage,
  1,
  c.research_run_id,
  c.decision_maker_id,
  '{}'::jsonb,
  case when c.projected_stage = 'portfolio' then 'portfolio_deferred' else null end,
  now(),
  now()
from (
  select
    l.id as lead_id,
    case
      when coalesce((l.metadata->>'admission_state'), 'unknown') in ('rejected', 'invalid') then 'failed'
      when l.latest_prospect_research_run_id is null or l.last_prospect_researched_at is null then 'waiting_for_research'
      when l.primary_decision_maker_id is null
        and coalesce(l.decision_maker_status, '') not in ('confirmed', 'verified_contactable', 'suspected')
        then 'waiting_for_dm'
      when coalesce(l.decision_maker_status, '') not in ('confirmed', 'verified_contactable')
        then 'waiting_for_contact_verification'
      else 'waiting_for_generation'
    end as projected_state,
    case
      when l.latest_prospect_research_run_id is null or l.last_prospect_researched_at is null then 'research'
      when l.primary_decision_maker_id is null
        and coalesce(l.decision_maker_status, '') not in ('confirmed', 'verified_contactable', 'suspected')
        then 'decision_maker'
      when coalesce(l.decision_maker_status, '') not in ('confirmed', 'verified_contactable')
        then 'contact_verification'
      else 'generation'
    end as projected_stage,
    l.latest_prospect_research_run_id::text as research_run_id,
    l.primary_decision_maker_id::text as decision_maker_id
  from growth.leads l
) c
where not exists (
  select 1
  from growth.draft_factory_lead_states s
  where s.organization_id = '${ORG}'::uuid
    and s.lead_id = c.lead_id
);
`)

  const after = extractRows(
    runQuery(`
select
  count(*)::int as rows_present,
  count(*) filter (where state = 'waiting_for_research')::int as waiting_for_research,
  count(*) filter (where state = 'waiting_for_dm')::int as waiting_for_dm,
  count(*) filter (where state = 'waiting_for_contact_verification')::int as waiting_for_contact_verification,
  count(*) filter (where state = 'waiting_for_personalization')::int as waiting_for_personalization,
  count(*) filter (where state = 'waiting_for_generation')::int as waiting_for_generation,
  count(*) filter (where state = 'waiting_for_approval')::int as waiting_for_approval,
  count(*) filter (where state = 'failed')::int as failed,
  count(*) filter (where state = 'paused')::int as stopped
from growth.draft_factory_lead_states
where organization_id = '${ORG}'::uuid;
`),
  )[0]

  console.log("\n--- After apply ---")
  console.log(JSON.stringify(after, null, 2))
  console.log("\n[SV1-5A] Reconcile APPLY complete — no paid work triggered.")
}

main()
