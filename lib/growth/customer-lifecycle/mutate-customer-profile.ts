import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"
import { fetchGrowthOpportunityByLeadId } from "@/lib/growth/opportunity-pipeline/pipeline-repository"
import {
  buildDefaultOnboardingTaskSpecs,
  insertGrowthCustomerOnboardingTaskRow,
} from "@/lib/growth/customer-lifecycle/customer-onboarding-task-repository"
import {
  emitCustomerCreatedTimeline,
  emitOnboardingStartedTimeline,
} from "@/lib/growth/customer-lifecycle/customer-lifecycle-timeline-emitter"
import {
  fetchGrowthCustomerProfileByLeadId,
  fetchGrowthCustomerProfileByOpportunityId,
  insertGrowthCustomerProfileRow,
} from "@/lib/growth/customer-lifecycle/customer-profile-repository"
import type { GrowthCustomerProfile } from "@/lib/growth/customer-lifecycle/customer-lifecycle-types"
import { recomputeGrowthCustomerProfile } from "@/lib/growth/customer-lifecycle/evaluate-customer-lifecycle"

type Actor = { userId?: string | null; email?: string | null }

export type CreateGrowthCustomerProfileResult =
  | { ok: true; profile: GrowthCustomerProfile }
  | { ok: false; code: string; message: string }

export async function createGrowthCustomerProfileFromCloseWon(
  admin: SupabaseClient,
  input: {
    opportunityId: string
    renewalDate?: string | null
    actor?: Actor
  },
): Promise<CreateGrowthCustomerProfileResult> {
  const existingByOpp = await fetchGrowthCustomerProfileByOpportunityId(admin, input.opportunityId)
  if (existingByOpp) {
    return { ok: false, code: "already_exists", message: "Customer profile already exists for this opportunity." }
  }

  const { data: opp, error } = await admin
    .schema("growth")
    .from("opportunities")
    .select("id, lead_id, owner_user_id, company_name, closed_won_at")
    .eq("id", input.opportunityId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!opp?.closed_won_at) {
    return { ok: false, code: "not_closed_won", message: "Opportunity must be closed won before creating a customer profile." }
  }

  const lead = await fetchGrowthLeadById(admin, opp.lead_id as string)
  if (!lead) return { ok: false, code: "lead_not_found", message: "Lead not found." }

  const existingByLead = await fetchGrowthCustomerProfileByLeadId(admin, lead.id)
  if (existingByLead) {
    return { ok: false, code: "already_exists", message: "Customer profile already exists for this lead." }
  }

  const profile = await insertGrowthCustomerProfileRow(admin, {
    lead_id: lead.id,
    opportunity_id: opp.id,
    organization_id: lead.promotedOrganizationId ?? null,
    owner_user_id: (opp.owner_user_id as string | null) ?? lead.assignedTo ?? input.actor?.userId ?? null,
    company_name: (opp.company_name as string) ?? lead.companyName,
    lifecycle_stage: "onboarding_pending",
    onboarding_status: "active",
    closed_won_at: opp.closed_won_at,
    last_engagement_at: opp.closed_won_at,
    renewal_date: input.renewalDate ?? null,
  })

  const baseDate = Date.parse(opp.closed_won_at as string)
  for (const spec of buildDefaultOnboardingTaskSpecs()) {
    const dueAt = new Date(baseDate + spec.offsetDays * 24 * 60 * 60 * 1000).toISOString()
    await insertGrowthCustomerOnboardingTaskRow(admin, {
      customer_profile_id: profile.id,
      owner_user_id: profile.ownerUserId,
      task_key: spec.taskKey,
      title: spec.title,
      instructions: spec.instructions,
      due_at: dueAt,
      status: "open",
    })
  }

  await emitCustomerCreatedTimeline(admin, {
    profile,
    actorUserId: input.actor?.userId ?? null,
    actorEmail: input.actor?.email ?? null,
  })
  await emitOnboardingStartedTimeline(admin, { profile })

  const enriched = await recomputeGrowthCustomerProfile(admin, profile)
  logGrowthEngine("customer_profile_created", { profileId: profile.id, opportunityId: opp.id, leadId: lead.id })
  return { ok: true, profile: enriched }
}

export async function createGrowthCustomerProfileFromLead(
  admin: SupabaseClient,
  input: { leadId: string; renewalDate?: string | null; actor?: Actor },
): Promise<CreateGrowthCustomerProfileResult> {
  const opportunity = await fetchGrowthOpportunityByLeadId(admin, input.leadId)
  if (!opportunity?.closedWonAt) {
    return { ok: false, code: "not_closed_won", message: "Lead opportunity must be closed won first." }
  }
  return createGrowthCustomerProfileFromCloseWon(admin, {
    opportunityId: opportunity.id,
    renewalDate: input.renewalDate,
    actor: input.actor,
  })
}
