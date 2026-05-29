import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { logGrowthEngine } from "@/lib/growth/access"
import type {
  GrowthBrowserIntakeBuyingCommitteeImportResult,
  GrowthBrowserIntakeBuyingCommitteeImportSelection,
} from "@/lib/growth/browser-intake/browser-intake-buying-committee-types"
import { createBrowserIntakeContact } from "@/lib/growth/browser-intake/create-browser-intake-contact"
import { createGrowthLeadDecisionMaker } from "@/lib/growth/decision-maker-repository"
import { fetchGrowthLeadById } from "@/lib/growth/lead-repository"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

export async function importBrowserIntakeBuyingCommitteeSelections(
  admin: SupabaseClient,
  input: {
    company_name: string
    lead_id?: string | null
    website?: string | null
    linkedin_url?: string | null
    source_url?: string | null
    selections: GrowthBrowserIntakeBuyingCommitteeImportSelection[]
    actorUserId: string | null
    actorEmail: string | null
  },
): Promise<GrowthBrowserIntakeBuyingCommitteeImportResult[]> {
  const companyName = asString(input.company_name)
  if (!companyName) throw new Error("company_name_required")
  if (!input.selections.length) return []

  let anchorLeadId = asString(input.lead_id) || null
  const results: GrowthBrowserIntakeBuyingCommitteeImportResult[] = []

  for (const selection of input.selections) {
    const fullName = asString(selection.full_name)
    if (!fullName) {
      results.push({
        candidate_id: selection.candidate_id,
        ok: false,
        lead_id: null,
        decision_maker_id: null,
        message: "Contact name is required.",
      })
      continue
    }

    try {
      const intake = await createBrowserIntakeContact(admin, {
        company_name: companyName,
        contact_name: fullName,
        title: selection.job_title,
        email: selection.email,
        phone: selection.phone,
        website: input.website,
        linkedin_url: selection.linkedin_url,
        source_url: input.source_url,
        source_platform: "linkedin",
        notes: selection.source ? `Buying committee import (${selection.source})` : "Buying committee import",
        capture_method: "chrome_extension",
        company_only: false,
        queue_contact_discovery: false,
        verify_email: false,
        intake_mode: "default",
        created_by: input.actorUserId,
        actor_email: input.actorEmail,
      })

      if (intake.status !== "created" && intake.status !== "updated") {
        results.push({
          candidate_id: selection.candidate_id,
          ok: false,
          lead_id: null,
          decision_maker_id: null,
          message: "message" in intake ? asString(intake.message) || "Import failed." : "Import failed.",
        })
        continue
      }

      if (!anchorLeadId) anchorLeadId = intake.lead_id

      let decisionMakerId: string | null = null
      const anchorLead = anchorLeadId ? await fetchGrowthLeadById(admin, anchorLeadId) : null
      if (anchorLead && anchorLead.id !== intake.lead_id) {
        const dm = await createGrowthLeadDecisionMaker(admin, {
          leadId: anchorLead.id,
          fullName,
          title: selection.job_title,
          email: selection.email,
          phone: selection.phone,
          linkedinUrl: selection.linkedin_url,
          source: "manual",
          sourceDetail: "browser_extension:buying_committee",
          evidenceExcerpt: selection.source ?? "Operator-selected buying committee import",
          status: "suspected",
          confidence: 0.78,
          isPrimary: false,
          createdBy: input.actorUserId,
        })
        decisionMakerId = dm.id
      } else {
        decisionMakerId = intake.decision_maker_id ?? null
      }

      results.push({
        candidate_id: selection.candidate_id,
        ok: true,
        lead_id: intake.lead_id,
        decision_maker_id: decisionMakerId,
        message: intake.status === "created" ? "Contact imported." : "Contact updated.",
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : "import_failed"
      results.push({
        candidate_id: selection.candidate_id,
        ok: false,
        lead_id: null,
        decision_maker_id: null,
        message,
      })
    }
  }

  logGrowthEngine("browser_intake_buying_committee_imported", {
    companyName,
    selectionCount: input.selections.length,
    successCount: results.filter((row) => row.ok).length,
    actorEmail: input.actorEmail,
  })

  return results
}
