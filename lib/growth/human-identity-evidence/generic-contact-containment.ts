/** Phase 7.PS-HV — Contain generic contact shells; preserve company-level channel evidence. Server-only. */

import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  classifyContactIdentity,
  type ContactIdentityClassification,
} from "@/lib/growth/human-identity-evidence/contact-identity-classification"
import {
  GROWTH_GENERIC_CONTACT_CONTAINMENT_QA_MARKER,
  type CompanyChannelRecord,
  type GenericContactContainmentMetrics,
  type GenericContactContainmentResult,
} from "@/lib/growth/human-identity-evidence/generic-contact-containment-types"
import { loadProspectGraphExpansionMetrics } from "@/lib/growth/graph-expansion/prospect-graph-expansion-metrics"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function emptyMetrics(): GenericContactContainmentMetrics {
  return {
    generic_shells_before: 0,
    generic_shells_after: 0,
    contacts_unlinked: 0,
    company_channels_preserved: 0,
    persons_contained: 0,
    named_person_density_before_pct: 0,
    named_person_density_after_pct: 0,
    persons_total_before: 0,
    persons_total_after: 0,
  }
}

async function countGenericPersonShells(
  admin: SupabaseClient,
  company_ids?: string[],
): Promise<number> {
  let query = admin
    .schema("growth")
    .from("company_contacts")
    .select("id, canonical_person_id, full_name, title, email, phone, linkedin_url, metadata")
    .not("canonical_person_id", "is", null)
    .neq("contact_status", "archived")
    .limit(500)

  if (company_ids?.length) {
    query = query.in("company_id", company_ids)
  }

  const { data } = await query
  let count = 0
  for (const row of data ?? []) {
    const classification = classifyContactIdentity({
      full_name: asString((row as Record<string, unknown>).full_name),
      title: asString((row as Record<string, unknown>).title),
      email: asString((row as Record<string, unknown>).email),
      phone: asString((row as Record<string, unknown>).phone),
      linkedin_url: asString((row as Record<string, unknown>).linkedin_url),
    })
    if (!classification.eligible_for_canonical_person) count += 1
  }
  return count
}

function channelRecordsFromContact(input: {
  company_contact_id: string
  classification: ContactIdentityClassification
  email: string | null
  phone: string | null
  linkedin_url: string | null
  source_type: string | null
  source_evidence: CompanyChannelRecord["source_evidence"]
}): CompanyChannelRecord[] {
  const contained_at = new Date().toISOString()
  const base = {
    classification: "company_channel" as const,
    identity_classification: input.classification,
    source_contact_id: input.company_contact_id,
    source_type: input.source_type,
    source_evidence: input.source_evidence,
    contained_at,
    qa_marker: GROWTH_GENERIC_CONTACT_CONTAINMENT_QA_MARKER,
  }

  const records: CompanyChannelRecord[] = []
  if (input.email) {
    records.push({ ...base, channel_type: "email", value: input.email })
  }
  if (input.phone) {
    records.push({ ...base, channel_type: "phone", value: input.phone })
  }
  if (input.linkedin_url) {
    records.push({ ...base, channel_type: "linkedin", value: input.linkedin_url })
  }
  return records
}

async function upsertCompanyChannels(
  admin: SupabaseClient,
  company_id: string,
  channels: CompanyChannelRecord[],
): Promise<number> {
  if (!company_id || channels.length === 0) return 0

  const { data: company } = await admin
    .schema("growth")
    .from("companies")
    .select("metadata")
    .eq("id", company_id)
    .maybeSingle()

  const metadata =
    company?.metadata && typeof company.metadata === "object"
      ? ({ ...(company.metadata as Record<string, unknown>) } as Record<string, unknown>)
      : {}

  const existing = Array.isArray(metadata.company_channels)
    ? (metadata.company_channels as CompanyChannelRecord[])
    : []

  const seen = new Set(existing.map((row) => `${row.channel_type}:${row.value.toLowerCase()}`))
  let added = 0
  for (const channel of channels) {
    const key = `${channel.channel_type}:${channel.value.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    existing.push(channel)
    added += 1
  }

  if (added === 0) return 0

  await admin
    .schema("growth")
    .from("companies")
    .update({
      metadata: {
        ...metadata,
        company_channels: existing,
        generic_contact_containment_qa_marker: GROWTH_GENERIC_CONTACT_CONTAINMENT_QA_MARKER,
        generic_contact_containment_updated_at: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", company_id)

  return added
}

async function markPersonContained(
  admin: SupabaseClient,
  person_id: string,
  source_contact_id: string,
): Promise<boolean> {
  const { data: person } = await admin
    .schema("growth")
    .from("persons")
    .select("id, metadata")
    .eq("id", person_id)
    .maybeSingle()

  if (!person) return false

  const metadata =
    person.metadata && typeof person.metadata === "object"
      ? ({ ...(person.metadata as Record<string, unknown>) } as Record<string, unknown>)
      : {}

  if (asString(metadata.containment_status) === "generic_shell_contained") return false

  await admin
    .schema("growth")
    .from("persons")
    .update({
      metadata: {
        ...metadata,
        containment_status: "generic_shell_contained",
        containment_qa_marker: GROWTH_GENERIC_CONTACT_CONTAINMENT_QA_MARKER,
        contained_at: new Date().toISOString(),
        contained_from_contact_id: source_contact_id,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", person_id)

  return true
}

export async function preserveCompanyChannelsFromContactRow(
  admin: SupabaseClient,
  input: {
    company_id: string
    company_contact_id: string
    full_name?: string | null
    title?: string | null
    email?: string | null
    phone?: string | null
    linkedin_url?: string | null
    source_type?: string | null
    source_evidence?: CompanyChannelRecord["source_evidence"]
    metadata?: Record<string, unknown>
  },
): Promise<number> {
  const identity = classifyContactIdentity(input)
  if (identity.eligible_for_canonical_person) return 0

  const channels = channelRecordsFromContact({
    company_contact_id: input.company_contact_id,
    classification: identity.classification,
    email: asString(input.email) || null,
    phone: asString(input.phone) || null,
    linkedin_url: asString(input.linkedin_url) || null,
    source_type: asString(input.source_type) || null,
    source_evidence: input.source_evidence ?? [],
  })

  const preserved = await upsertCompanyChannels(admin, input.company_id, channels)

  const contactMetadata = { ...(input.metadata ?? {}) }
  await admin
    .schema("growth")
    .from("company_contacts")
    .update({
      metadata: {
        ...contactMetadata,
        identity_classification: identity.classification,
        identity_classification_reasons: identity.reasons,
        generic_contact_containment_qa_marker: GROWTH_GENERIC_CONTACT_CONTAINMENT_QA_MARKER,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.company_contact_id)

  return preserved
}

export async function runGenericContactContainment(
  admin: SupabaseClient,
  input: {
    company_ids?: string[]
    mode?: "dry_run" | "apply"
    limit?: number
  } = {},
): Promise<GenericContactContainmentResult> {
  const mode = input.mode ?? "apply"
  const limit = input.limit ?? 200
  const metrics = emptyMetrics()
  const samples: GenericContactContainmentResult["samples"] = []
  const messages: string[] = []

  const beforeMetrics = await loadProspectGraphExpansionMetrics(admin, {
    company_ids: input.company_ids,
    industry_contains: input.company_ids?.length ? null : "biomedical",
    limit: 500,
  })
  metrics.named_person_density_before_pct = beforeMetrics.metrics.named_person_density_pct
  metrics.persons_total_before = beforeMetrics.metrics.persons_total
  metrics.generic_shells_before = await countGenericPersonShells(admin, input.company_ids)

  let query = admin
    .schema("growth")
    .from("company_contacts")
    .select(
      "id, company_id, canonical_person_id, full_name, title, email, phone, linkedin_url, source_type, source_evidence, metadata, contact_status",
    )
    .not("canonical_person_id", "is", null)
    .neq("contact_status", "archived")
    .order("updated_at", { ascending: false })
    .limit(limit * 2)

  if (input.company_ids?.length) {
    query = query.in("company_id", input.company_ids)
  }

  const { data: rows } = await query
  const containedPersonIds = new Set<string>()

  for (const row of rows ?? []) {
    const record = row as Record<string, unknown>
    const company_contact_id = asString(record.id)
    const company_id = asString(record.company_id)
    const person_id = asString(record.canonical_person_id)
    if (!company_contact_id || !company_id || !person_id) continue

    const identity = classifyContactIdentity({
      full_name: asString(record.full_name),
      title: asString(record.title),
      email: asString(record.email),
      phone: asString(record.phone),
      linkedin_url: asString(record.linkedin_url),
      source_type: asString(record.source_type),
    })

    if (identity.eligible_for_canonical_person) continue

    const source_evidence = Array.isArray(record.source_evidence)
      ? (record.source_evidence as CompanyChannelRecord["source_evidence"])
      : []

    const channels = channelRecordsFromContact({
      company_contact_id,
      classification: identity.classification,
      email: asString(record.email) || null,
      phone: asString(record.phone) || null,
      linkedin_url: asString(record.linkedin_url) || null,
      source_type: asString(record.source_type) || null,
      source_evidence,
    })

    if (mode === "apply") {
      const preserved = await upsertCompanyChannels(admin, company_id, channels)
      metrics.company_channels_preserved += preserved

      const contactMetadata =
        record.metadata && typeof record.metadata === "object"
          ? ({ ...(record.metadata as Record<string, unknown>) } as Record<string, unknown>)
          : {}

      await admin
        .schema("growth")
        .from("company_contacts")
        .update({
          canonical_person_id: null,
          metadata: {
            ...contactMetadata,
            identity_classification: identity.classification,
            identity_classification_reasons: identity.reasons,
            generic_contact_containment_qa_marker: GROWTH_GENERIC_CONTACT_CONTAINMENT_QA_MARKER,
            contained_at: new Date().toISOString(),
            contained_person_id: person_id,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", company_contact_id)

      if (!containedPersonIds.has(person_id)) {
        const marked = await markPersonContained(admin, person_id, company_contact_id)
        if (marked) {
          containedPersonIds.add(person_id)
          metrics.persons_contained += 1
        }
      }
    } else {
      metrics.company_channels_preserved += channels.length
    }

    metrics.contacts_unlinked += 1
    if (samples.length < 20) {
      samples.push({
        company_contact_id,
        company_id,
        previous_person_id: person_id,
        classification: identity.classification,
        channels_preserved: channels.map((c) => `${c.channel_type}:${c.value}`),
      })
    }
  }

  const afterMetrics = await loadProspectGraphExpansionMetrics(admin, {
    company_ids: input.company_ids,
    industry_contains: input.company_ids?.length ? null : "biomedical",
    limit: 500,
  })
  metrics.named_person_density_after_pct = afterMetrics.metrics.named_person_density_pct
  metrics.persons_total_after = afterMetrics.metrics.persons_total
  metrics.generic_shells_after = await countGenericPersonShells(admin, input.company_ids)

  messages.push(
    `shells ${metrics.generic_shells_before}→${metrics.generic_shells_after} contacts_unlinked=${metrics.contacts_unlinked} channels_preserved=${metrics.company_channels_preserved}`,
  )
  messages.push(
    `named_density ${metrics.named_person_density_before_pct}%→${metrics.named_person_density_after_pct}% persons ${metrics.persons_total_before}→${metrics.persons_total_after}`,
  )

  const ok =
    metrics.contacts_unlinked > 0
      ? metrics.generic_shells_after <= metrics.generic_shells_before &&
        metrics.company_channels_preserved > 0
      : metrics.generic_shells_before === 0

  return {
    qa_marker: GROWTH_GENERIC_CONTACT_CONTAINMENT_QA_MARKER,
    ok,
    metrics,
    samples,
    messages,
  }
}
