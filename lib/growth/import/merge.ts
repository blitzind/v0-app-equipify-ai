import type { GrowthLead } from "@/lib/growth/types"
import { mergeLeadMetadataTags } from "@/lib/growth/import/batch-tags"
import type { NormalizedImportRow } from "@/lib/growth/import/types"
import { trimOrNull } from "@/lib/growth/import/normalize"

/**
 * Protected merge fields — never overwritten on import merge:
 * - manual notes
 * - decision maker confirmations
 * - call history
 * - priority override
 * - human touch timestamps
 */
export function buildProtectedMergePatch(
  existing: GrowthLead,
  incoming: NormalizedImportRow,
  input: {
    sourceChannel: string | null
    sourceCampaign: string | null
    sourceVendor: string | null
    sourceImportBatchId: string
    externalRef: string | null
    rowIndex: number
    autoTags?: string[]
    contactabilityScore?: number
    seamlessTierB?: Record<string, string>
  },
): Record<string, unknown> {
  const patch: Record<string, unknown> = {}
  const existingMetadata = existing.metadata ?? {}
  const importMeta = {
    ...(((existingMetadata.import as Record<string, unknown> | undefined) ?? {})),
    batchId: input.sourceImportBatchId,
    rowIndex: input.rowIndex,
    vendorKey: input.sourceVendor,
    linkedin: incoming.linkedinUrl,
    contactabilityScore: input.contactabilityScore,
    importedAt: new Date().toISOString(),
    ...(input.seamlessTierB ? { seamlessTierB: input.seamlessTierB } : {}),
  }

  patch.metadata = {
    ...existingMetadata,
    tags: mergeLeadMetadataTags(existingMetadata.tags, input.autoTags ?? []),
    import: importMeta,
  }

  if (!existing.contactName && incoming.contactName) patch.contact_name = incoming.contactName
  if (!existing.contactEmail && incoming.email) patch.contact_email = incoming.email
  if (!existing.contactPhone && incoming.phone) patch.contact_phone = incoming.phone
  if (!existing.website && incoming.website) patch.website = incoming.website
  if (!existing.addressLine1 && incoming.addressLine1) patch.address_line1 = incoming.addressLine1
  if (!existing.city && incoming.city) patch.city = incoming.city
  if (!existing.state && incoming.state) patch.state = incoming.state
  if (!existing.postalCode && incoming.postalCode) patch.postal_code = incoming.postalCode
  if (!existing.country && incoming.country) patch.country = incoming.country

  if (!existing.sourceChannel && input.sourceChannel) patch.source_channel = input.sourceChannel
  if (!existing.sourceCampaign && input.sourceCampaign) patch.source_campaign = input.sourceCampaign
  if (!existing.sourceVendor && input.sourceVendor) patch.source_vendor = input.sourceVendor
  if (!existing.sourceImportBatchId) patch.source_import_batch_id = input.sourceImportBatchId
  if (!existing.externalRef && input.externalRef) patch.external_ref = input.externalRef

  return patch
}

export function buildCreateLeadInputFromImportRow(
  incoming: NormalizedImportRow,
  input: {
    sourceChannel: string | null
    sourceCampaign: string | null
    sourceVendor: string | null
    sourceImportBatchId: string
    externalRef: string | null
    rowIndex: number
    createdBy: string | null
    autoTags?: string[]
    contactabilityScore?: number
    seamlessTierB?: Record<string, string>
  },
) {
  return {
    sourceKind: "import" as const,
    externalRef: input.externalRef,
    companyName: incoming.companyName,
    contactName: incoming.contactName,
    contactEmail: incoming.email,
    contactPhone: incoming.phone,
    website: incoming.website,
    addressLine1: incoming.addressLine1,
    city: incoming.city,
    state: incoming.state,
    postalCode: incoming.postalCode,
    country: incoming.country ?? "US",
    notes: trimOrNull(incoming.notes),
    sourceChannel: input.sourceChannel,
    sourceCampaign: input.sourceCampaign,
    sourceImportBatchId: input.sourceImportBatchId,
    sourceVendor: input.sourceVendor,
    createdBy: input.createdBy,
    metadata: {
      tags: input.autoTags ?? [],
      import: {
        batchId: input.sourceImportBatchId,
        rowIndex: input.rowIndex,
        vendorKey: input.sourceVendor,
        linkedin: incoming.linkedinUrl,
        title: incoming.title,
        contactabilityScore: input.contactabilityScore,
        importedAt: new Date().toISOString(),
        ...(input.seamlessTierB ? { seamlessTierB: input.seamlessTierB } : {}),
      },
    },
  }
}
