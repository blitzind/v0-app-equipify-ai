/** GE-AIOS-15B — Intake path relationship graph binding intent (client-safe). */

import type { GrowthRelationshipStage } from "@/lib/growth/lead-memory/memory-types"
import {
  readCanonicalCompanyIdFromMetadata,
  readPersonIdFromMetadata,
} from "@/lib/growth/relationship/parse-relationship-graph-refs"
import {
  buildRelationshipGraphContext,
  type AvaRelationshipGraphContext,
  type RelationshipGraphBindingInput,
} from "@/lib/growth/relationship/relationship-graph-types"

export const GROWTH_INTAKE_RELATIONSHIP_BINDING_QA_MARKER = "ge-aios-15b-intake-relationship-binding-v1" as const
export const GROWTH_INTAKE_GRAPH_BINDING_15C_QA_MARKER = "ge-aios-15c-intake-graph-binding-v1" as const

export type IntakeRelationshipBindingStatus = "bound" | "partial" | "skipped" | "failed"

export type IntakeRelationshipBindingSource =
  | "datamoon"
  | "browser_capture"
  | "manual_lead"
  | "discovery_import"
  | "revenue_queue"
  | "unknown"

export type IntakeRelationshipBindingIntent = {
  qa_marker: typeof GROWTH_INTAKE_RELATIONSHIP_BINDING_QA_MARKER
  source: IntakeRelationshipBindingSource
  bind_lead_workspace: true
  bind_canonical_company: boolean
  bind_person: boolean
  bind_buying_committee_intelligence: boolean
  use_legacy_buying_committee_writes: false
  fields_to_persist: Array<
    | "growth.leads.id"
    | "growth.leads.metadata.canonical_company_id"
    | "growth.companies.id"
    | "growth.persons.id"
    | "buying_committee_intelligence_members"
    | "person_company_roles"
  >
}

export function buildIntakeRelationshipBindingIntent(
  source: IntakeRelationshipBindingSource,
): IntakeRelationshipBindingIntent {
  return {
    qa_marker: GROWTH_INTAKE_RELATIONSHIP_BINDING_QA_MARKER,
    source,
    bind_lead_workspace: true,
    bind_canonical_company: true,
    bind_person: source !== "manual_lead",
    bind_buying_committee_intelligence: true,
    use_legacy_buying_committee_writes: false,
    fields_to_persist: [
      "growth.leads.id",
      "growth.leads.metadata.canonical_company_id",
      "growth.companies.id",
      "growth.persons.id",
      "buying_committee_intelligence_members",
      "person_company_roles",
    ],
  }
}

export function extractRelationshipGraphFromLeadMetadata(input: {
  lead_id: string
  metadata?: Record<string, unknown> | null
  primary_decision_maker_id?: string | null
  relationship_stage?: GrowthRelationshipStage | null
  organization_id?: string | null
}): AvaRelationshipGraphContext {
  const metadata = input.metadata ?? null
  const person_id = readPersonIdFromMetadata(metadata) ?? input.primary_decision_maker_id ?? null

  const binding: RelationshipGraphBindingInput = {
    organization_id: input.organization_id ?? null,
    lead_id: input.lead_id,
    canonical_company_id: readCanonicalCompanyIdFromMetadata(metadata),
    person_id,
    relationship_stage: input.relationship_stage ?? null,
    memory_context_available: Boolean(metadata && Object.keys(metadata).length > 0),
    business_intelligence_context_available: Boolean(readCanonicalCompanyIdFromMetadata(metadata)),
  }

  return buildRelationshipGraphContext(binding)
}

export type IntakeRelationshipGraphMetadataContract = {
  canonical_company_id?: string | null
  company_domain?: string | null
  company_source?: string | null
  relationship_binding_status: IntakeRelationshipBindingStatus
  relationship_binding_attempted_at: string
  relationship_binding_warnings: string[]
  source_lineage: Record<string, unknown>
  primary_person_id?: string | null
  person_company_role_id?: string | null
  committee_role?: string | null
}

export function mergeIntakeRelationshipBindingMetadata(
  metadata: Record<string, unknown> | null | undefined,
  graph: AvaRelationshipGraphContext,
  contract?: Partial<IntakeRelationshipGraphMetadataContract> & {
    intent?: IntakeRelationshipBindingIntent
  },
): Record<string, unknown> {
  const base = { ...(metadata ?? {}) }
  const canonicalCompanyId = contract?.canonical_company_id ?? graph.canonical_company_id
  if (canonicalCompanyId) {
    base.canonical_company_id = canonicalCompanyId
  }
  if (contract?.company_domain) {
    base.company_domain = contract.company_domain
  }
  if (contract?.company_source) {
    base.company_source = contract.company_source
  }
  if (contract?.relationship_binding_status) {
    base.relationship_binding_status = contract.relationship_binding_status
  }
  if (contract?.relationship_binding_attempted_at) {
    base.relationship_binding_attempted_at = contract.relationship_binding_attempted_at
  }
  if (contract?.relationship_binding_warnings) {
    base.relationship_binding_warnings = contract.relationship_binding_warnings
  }
  if (contract?.source_lineage) {
    base.source_lineage = contract.source_lineage
  }
  const primaryPersonId = contract?.primary_person_id ?? graph.person_id
  if (primaryPersonId) {
    base.primary_person_id = primaryPersonId
  }
  if (contract?.person_company_role_id) {
    base.person_company_role_id = contract.person_company_role_id
  }
  if (contract?.committee_role) {
    base.committee_role = contract.committee_role
  }
  base.relationship_graph = graph
  base.relationship_binding_qa_marker = GROWTH_INTAKE_RELATIONSHIP_BINDING_QA_MARKER
  base.relationship_binding_15c_qa_marker = GROWTH_INTAKE_GRAPH_BINDING_15C_QA_MARKER
  if (contract?.intent) {
    base.relationship_binding_intent = contract.intent
  }
  return base
}
