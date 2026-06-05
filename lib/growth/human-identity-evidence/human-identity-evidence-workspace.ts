import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { baseConfidenceForPhoneSource } from "@/lib/growth/phone-discovery/phone-discovery-confidence"
import type {
  HumanIdentityEvidenceReviewAction,
  HumanIdentityEvidenceWorkspace,
} from "@/lib/growth/human-identity-evidence/human-identity-evidence-types"
import { loadHumanIdentityEvidenceQueue } from "@/lib/growth/human-identity-evidence/human-identity-evidence-queue"

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : ""
}

export async function loadHumanIdentityEvidenceWorkspace(
  admin: SupabaseClient,
  company_contact_id: string,
): Promise<HumanIdentityEvidenceWorkspace | null> {
  const queue = await loadHumanIdentityEvidenceQueue(admin, { limit: 500 })
  const item = queue.find((r) => r.company_contact_id === company_contact_id)
  if (!item) return null

  const { data: contact } = await admin
    .schema("growth")
    .from("company_contacts")
    .select("source_evidence, metadata")
    .eq("id", company_contact_id)
    .maybeSingle()

  const source_evidence = Array.isArray(contact?.source_evidence)
    ? (contact.source_evidence as HumanIdentityEvidenceWorkspace["source_evidence"])
    : []

  let canonical_person: HumanIdentityEvidenceWorkspace["canonical_person"] = null
  if (item.canonical_person_id) {
    const { data: person } = await admin
      .schema("growth")
      .from("persons")
      .select("id, full_name, normalized_name, first_name, last_name")
      .eq("id", item.canonical_person_id)
      .maybeSingle()
    if (person) {
      canonical_person = {
        person_id: asString(person.id),
        full_name: asString(person.full_name),
        normalized_name: asString(person.normalized_name),
        first_name: asString(person.first_name) || null,
        last_name: asString(person.last_name) || null,
      }
    }
  }

  const trusted =
    item.contact_status === "verified" || item.phone_status === "verified"
  const promotion_confidence_preview = trusted
    ? 0.9
    : baseConfidenceForPhoneSource("staging_contact")

  const allowed_actions: HumanIdentityEvidenceReviewAction[] = []
  if (item.contact_status !== "verified") allowed_actions.push("mark_contact_verified")
  if (item.phone?.trim() && item.phone_status !== "verified") {
    allowed_actions.push("mark_phone_verified")
  }
  if (source_evidence.length > 0 || item.source_url) {
    allowed_actions.push("update_name_from_evidence", "update_title_from_evidence")
  }

  return {
    queue_item: item,
    source_evidence,
    canonical_person,
    staging_trusted_preview: trusted,
    promotion_confidence_preview,
    allowed_actions,
  }
}
