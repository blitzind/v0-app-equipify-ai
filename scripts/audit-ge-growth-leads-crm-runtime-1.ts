/**
 * GE-GROWTH-LEADS-CRM-RUNTIME-AUDIT-1 — reproduce CRM deep-link crashes against production lead data.
 */
import { createClient } from "@supabase/supabase-js"

const LEAD_ID = "ec176375-8b43-4fa5-b63d-3cfdc8a18461"

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Missing Supabase env")

  const admin = createClient(url, key, { auth: { persistSession: false } })
  const { fetchGrowthLeadById } = await import("../lib/growth/lead-repository.ts")
  const { resolveLeadCommunicationStrategyBundle } = await import(
    "../lib/growth/contact-verification/lead-communication-strategy-resolver.ts"
  )
  const { getGrowthEngineAiOrgId } = await import("../lib/growth/access.ts")

  const lead = await fetchGrowthLeadById(admin, LEAD_ID)
  if (!lead) {
    console.log("Lead not found:", LEAD_ID)
    return
  }

  console.log("Lead:", lead.companyName, lead.sourceKind, lead.sourceChannel)

  const issues: string[] = []

  try {
    const channel = lead.sourceChannel ?? lead.sourceKind.replace(/_/g, " ")
    console.log("formatSource OK:", channel)
  } catch (error) {
    issues.push(`formatSource: ${error instanceof Error ? error.message : String(error)}`)
  }

  const { readRevenueReadinessFromLeadMetadata } = await import(
    "../lib/growth/revenue-workflow/revenue-workflow-types.ts"
  )
  try {
    const snapshot = readRevenueReadinessFromLeadMetadata(lead.metadata)
    if (snapshot) {
      void snapshot.topPositiveSignals.length
      void snapshot.topRisks.length
      console.log("revenue readiness snapshot OK")
    } else {
      console.log("revenue readiness snapshot: null")
    }
  } catch (error) {
    issues.push(`revenue-readiness: ${error instanceof Error ? error.message : String(error)}`)
  }

  try {
    process.env.NEXT_PUBLIC_GROWTH_NATIVE_DECISION_ENGINE =
      process.env.NEXT_PUBLIC_GROWTH_NATIVE_DECISION_ENGINE ?? "true"
    const resolved = await resolveLeadCommunicationStrategyBundle(lead, {
      organizationId: getGrowthEngineAiOrgId(),
      admin,
    })
    console.log("communication-strategy enabled:", resolved.enabled, "bundle:", !!resolved.bundle)
    const cs = resolved.bundle?.communication_strategy_display
    const ds = resolved.bundle?.display_summary
    if (cs) {
      void cs.reasoning[0]
      void cs.fallback_channels.length
      console.log("communication_strategy_display OK")
    }
    if (ds) {
      void ds.reasons[0]
      void ds.blockers.length
      console.log("display_summary OK")
    }
  } catch (error) {
    issues.push(`communication-strategy: ${error instanceof Error ? error.message : String(error)}`)
    if (error instanceof Error && error.stack) {
      console.log(error.stack.split("\n").slice(0, 8).join("\n"))
    }
  }

  try {
    const response = await fetch(
      `http://localhost:0/api/platform/growth/opportunities/dashboard?leadId=${LEAD_ID}`,
    ).catch(() => null)
    void response
  } catch {
    // skip — server not running
  }

  const { loadGrowthOpportunityIntelligenceForLead } = await import(
    "../lib/growth/opportunity-intelligence/opportunity-intelligence-service.ts"
  ).catch(() => ({ loadGrowthOpportunityIntelligenceForLead: null }))

  if (loadGrowthOpportunityIntelligenceForLead) {
    try {
      const orgId = getGrowthEngineAiOrgId()
      const intel = await loadGrowthOpportunityIntelligenceForLead(admin, orgId, LEAD_ID)
      void intel?.opportunitySignals.length
      void intel?.recommendedActions.length
      console.log("opportunity intelligence OK")
    } catch (error) {
      issues.push(`opportunity-intelligence: ${error instanceof Error ? error.message : String(error)}`)
      if (error instanceof Error && error.stack) {
        console.log(error.stack.split("\n").slice(0, 8).join("\n"))
      }
    }
  }

  console.log(issues.length ? `\nISSUES:\n${issues.join("\n")}` : "\nAll audited paths OK")
}

void main()
