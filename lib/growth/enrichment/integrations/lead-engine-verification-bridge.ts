import type { GrowthLeadEngineVerificationTriageOutput } from "@/lib/growth/lead-engine/verification-triage-types"
import type { GrowthVerificationEnrichmentSnapshot } from "@/lib/growth/enrichment/enrichment-types"

/** Maps enrichment snapshot into verification triage-shaped summary (read-only bridge). */
export function enrichmentSnapshotToVerificationTriageHints(
  snapshot: GrowthVerificationEnrichmentSnapshot,
): Pick<
  GrowthLeadEngineVerificationTriageOutput,
  "verification_confidence" | "evidence_summary" | "risk_summary"
> {
  const contact = snapshot.contact_verifications[0]
  const company = snapshot.company_enrichments[0]
  return {
    verification_confidence: contact?.verification_confidence ?? company?.confidence ?? 0,
    evidence_summary:
      contact?.verification_reason ??
      "Enrichment infrastructure — observed signals only, no guessed validation.",
    risk_summary: snapshot.privacy_note,
  }
}
