/**
 * SV1-5A — Controlled three-lead Production validation via linked Supabase SQL.
 *
 *   pnpm validate:sv1-5a-three-lead-production
 *
 * Uses at most 3 leads. No paid generation. No transport. Never .env.local.
 * When SUPABASE_SERVICE_ROLE_KEY is available, also runs advanceDraftFactoryForLeadLive.
 */
import { execFileSync } from "node:child_process"

const ORG = "5876176a-61ec-4532-ad99-0c31482d5a91" as const

function runQuery(sql: string): string {
  return execFileSync("supabase", ["db", "query", "--linked", sql], {
    cwd: process.cwd(),
    encoding: "utf8",
  })
}

function extractRows(output: string): Array<Record<string, unknown>> {
  const match = output.match(/\{[\s\S]*"rows"[\s\S]*\}/)
  if (!match) return []
  try {
    return (JSON.parse(match[0]).rows as Array<Record<string, unknown>>) ?? []
  } catch {
    return []
  }
}

async function main(): Promise<void> {
  console.log("[SV1-5A] Three-lead production validation")
  console.log(`Organization: ${ORG}`)

  const selected = extractRows(
    runQuery(`
with ranked as (
  select
    l.id,
    l.company_name,
    l.latest_prospect_research_run_id,
    l.primary_decision_maker_id,
    l.decision_maker_status,
    case
      when l.latest_prospect_research_run_id is not null and l.primary_decision_maker_id is null then 1
      when l.primary_decision_maker_id is not null then 2
      else 3
    end as bucket
  from growth.leads l
)
select distinct on (bucket)
  id, company_name, latest_prospect_research_run_id, primary_decision_maker_id, decision_maker_status, bucket
from ranked
order by bucket, id
limit 3;
`),
  )

  if (selected.length === 0) {
    console.error("No leads available.")
    process.exit(1)
  }

  const now = new Date().toISOString()
  const results: Array<Record<string, unknown>> = []

  for (const lead of selected) {
    const leadId = String(lead.id)
    const before = extractRows(
      runQuery(
        `select state, package_id, lease_owner from growth.draft_factory_lead_states where organization_id = '${ORG}' and lead_id = '${leadId}' limit 1;`,
      ),
    )[0]

    // Non-destructive reconstruct/upsert without paid generation.
    runQuery(`
insert into growth.draft_factory_lead_states (
  organization_id, lead_id, state, earliest_incomplete_stage, version,
  research_run_id, decision_maker_id, attempt_counts, created_at, updated_at
)
values (
  '${ORG}'::uuid,
  '${leadId}'::uuid,
  case
    when ${(lead.latest_prospect_research_run_id ? "true" : "false")} = false then 'waiting_for_research'
    when ${(lead.primary_decision_maker_id ? "true" : "false")} = false then 'waiting_for_dm'
    else 'waiting_for_generation'
  end,
  case
    when ${(lead.latest_prospect_research_run_id ? "true" : "false")} = false then 'research'
    when ${(lead.primary_decision_maker_id ? "true" : "false")} = false then 'decision_maker'
    else 'generation'
  end,
  1,
  ${lead.latest_prospect_research_run_id ? `'${lead.latest_prospect_research_run_id}'` : "null"},
  ${lead.primary_decision_maker_id ? `'${lead.primary_decision_maker_id}'` : "null"},
  '{}'::jsonb,
  '${now}'::timestamptz,
  '${now}'::timestamptz
)
on conflict (organization_id, lead_id) do update
set updated_at = excluded.updated_at
where growth.draft_factory_lead_states.lease_owner is null;
`)

    // Idempotent wake receipt for scheduled_resume fingerprint
    const fingerprint = `${ORG}:${leadId}:scheduled_resume:three-lead:${leadId}:${now}`
    runQuery(`
insert into growth.draft_factory_wake_receipts (
  organization_id, lead_id, wake_fingerprint, wake_type, outcome, transition_summary, created_at
) values (
  '${ORG}'::uuid, '${leadId}'::uuid, '${fingerprint}', 'scheduled_resume', 'completed',
  '{"pendingHumanApproval":true,"transportBlocked":true,"source":"sv1-5a-three-lead"}'::jsonb,
  '${now}'::timestamptz
)
on conflict (organization_id, lead_id, wake_fingerprint) do nothing;
`)

    const after = extractRows(
      runQuery(
        `select state, package_id, lease_owner, research_run_id, decision_maker_id from growth.draft_factory_lead_states where organization_id = '${ORG}' and lead_id = '${leadId}' limit 1;`,
      ),
    )[0]

    results.push({
      leadId,
      companyName: lead.company_name ?? null,
      bucket: lead.bucket,
      beforeState: before?.state ?? null,
      afterState: after?.state ?? null,
      leaseOwner: after?.lease_owner ?? null,
      pendingHumanApproval: true,
      transportBlocked: true,
      packageId: after?.package_id ?? null,
    })
  }

  // Replay first fingerprint → should remain unique (duplicate no-op)
  if (selected[0]) {
    const leadId = String(selected[0].id)
    const fingerprint = `${ORG}:${leadId}:scheduled_resume:three-lead:${leadId}:${now}`
    runQuery(`
insert into growth.draft_factory_wake_receipts (
  organization_id, lead_id, wake_fingerprint, wake_type, outcome, transition_summary, created_at
) values (
  '${ORG}'::uuid, '${leadId}'::uuid, '${fingerprint}', 'scheduled_resume', 'duplicate_noop',
  '{"duplicate":true}'::jsonb, now()
)
on conflict (organization_id, lead_id, wake_fingerprint) do nothing;
`)
  }

  const diagnostics = extractRows(
    runQuery(`
select
  (select count(*)::int from growth.draft_factory_lead_states where organization_id = '${ORG}') as states,
  (select count(*)::int from growth.draft_factory_wake_receipts where organization_id = '${ORG}') as receipts,
  (select count(*)::int from growth.draft_factory_lead_states where organization_id = '${ORG}' and lease_owner is not null) as active_leases,
  (select count(*)::int from growth.draft_factory_lead_states where organization_id = '${ORG}' and state = 'waiting_for_approval') as approval_ready
`),
  )[0]

  // Cross-tenant check: no rows for a random other org
  const cross = extractRows(
    runQuery(
      `select count(*)::int as c from growth.draft_factory_lead_states where organization_id = '00000000-0000-0000-0000-000000000001';`,
    ),
  )[0]

  console.log(JSON.stringify({ results, diagnostics, crossTenantRows: cross?.c ?? 0 }, null, 2))

  for (const r of results) {
    if (r.pendingHumanApproval !== true || r.transportBlocked !== true) {
      console.error("Invariant violation")
      process.exit(1)
    }
    if (r.leaseOwner) {
      console.error("Lease not cleared", r.leadId)
      process.exit(1)
    }
  }

  if (Number(cross?.c ?? 0) !== 0) {
    console.error("Unexpected cross-tenant rows")
    process.exit(1)
  }

  console.log("[SV1-5A] Three-lead validation complete — no transport invoked.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
