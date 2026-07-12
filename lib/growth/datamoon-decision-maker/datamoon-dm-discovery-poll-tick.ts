/**
 * GE-AIOS-CONTACT-1B — Poll due DataMoon DM discoveries inside AUTONOMY-1B due tick.
 * No new Vercel cron. One poll per due run; completion wakes Draft Factory.
 */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { listDueDatamoonDmDiscoveryRuns } from "@/lib/growth/datamoon-decision-maker/datamoon-dm-discovery-durable-store"
import { createLiveDatamoonDecisionMakerDiscoveryAdapter } from "@/lib/growth/datamoon-decision-maker/datamoon-dm-discovery-live-adapter"
import { GROWTH_AIOS_CONTACT_1B_QA_MARKER } from "@/lib/growth/datamoon-decision-maker/datamoon-dm-discovery-types"
import { evaluateAndEnrichDecisionMakerForLead } from "@/lib/growth/datamoon-decision-maker/datamoon-dm-service"

export async function pollDueDatamoonDmDiscoveriesForOrganization(
  admin: SupabaseClient,
  input: {
    organizationId: string
    now?: string
    limit?: number
    portfolioSelected?: boolean
  },
): Promise<{
  qaMarker: typeof GROWTH_AIOS_CONTACT_1B_QA_MARKER
  dueFound: number
  polled: number
  completed: number
  stillPending: number
  failed: number
}> {
  const now = input.now ?? new Date().toISOString()
  const due = await listDueDatamoonDmDiscoveryRuns(admin, {
    organizationId: input.organizationId,
    now,
    limit: input.limit ?? 10,
  })

  const adapter = createLiveDatamoonDecisionMakerDiscoveryAdapter({ admin })
  let polled = 0
  let completed = 0
  let stillPending = 0
  let failed = 0

  for (const run of due) {
    const status = await adapter.getDiscoveryStatus({ runId: run.runId, now })
    polled += 1

    if (status.status === "failed_terminal" || status.status === "failed_retryable") {
      failed += 1
      continue
    }

    if (status.readyForFetch || status.status === "completed" || status.status === "no_result") {
      completed += 1
      // Re-enter enrichment so CONTACT-1A persist + completion wakes fire once.
      await evaluateAndEnrichDecisionMakerForLead(admin, {
        organizationId: input.organizationId,
        leadId: run.leadId,
        portfolioSelected: input.portfolioSelected !== false,
        budgetAvailable: true,
        useLiveDiscoveryAdapter: true,
        generatedAt: now,
      }).catch((error) => {
        logGrowthEngine("datamoon_dm_discovery_poll_enrich_failed", {
          qa_marker: GROWTH_AIOS_CONTACT_1B_QA_MARKER,
          lead_id: run.leadId,
          run_id: run.runId,
          message: error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200),
        })
      })
      continue
    }

    stillPending += 1
  }

  if (due.length > 0) {
    logGrowthEngine("datamoon_dm_discovery_due_poll_tick", {
      qa_marker: GROWTH_AIOS_CONTACT_1B_QA_MARKER,
      organization_id: input.organizationId,
      due_found: due.length,
      polled,
      completed,
      still_pending: stillPending,
      failed,
    })
  }

  return {
    qaMarker: GROWTH_AIOS_CONTACT_1B_QA_MARKER,
    dueFound: due.length,
    polled,
    completed,
    stillPending,
    failed,
  }
}
