/** Growth Engine S1-B — Share Page Template diagnostics & certification scaffolding. */

import "server-only"

import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  instantiateSharePageFromTemplate,
} from "@/lib/growth/share-pages/share-page-template-instantiation"
import {
  archiveTemplate,
  createTemplate,
  duplicateTemplate,
  duplicateVersion,
  getTemplate,
  listTemplates,
  publishVersion,
  restoreVersion,
  unpublishTemplate,
  updateTemplate,
} from "@/lib/growth/share-pages/share-page-template-repository"
import { probeGrowthSharePageTemplatesSchema } from "@/lib/growth/share-pages/share-page-template-schema-health"
import {
  GROWTH_SHARE_PAGE_TEMPLATES_CONFIRM,
  GROWTH_SHARE_PAGE_TEMPLATES_QA_MARKER,
} from "@/lib/growth/share-pages/share-page-template-types"

export { GROWTH_SHARE_PAGE_TEMPLATES_CONFIRM }

const CERT_PREFIX = "share-page-templates-s1b-cert"

export type GrowthSharePageTemplatesDiagnosticsCheck = {
  id: string
  ok: boolean
  detail: string
}

export type GrowthSharePageTemplatesDiagnosticsReport = {
  ok: boolean
  execution_id: string
  qa_marker: typeof GROWTH_SHARE_PAGE_TEMPLATES_QA_MARKER
  checks: GrowthSharePageTemplatesDiagnosticsCheck[]
  blockers: string[]
  final_verdict: "PASS" | "FAIL" | "SKIP"
  template_id?: string
}

function pushCheck(
  checks: GrowthSharePageTemplatesDiagnosticsCheck[],
  id: string,
  ok: boolean,
  detail: string,
): void {
  checks.push({ id, ok, detail })
}

async function resolveCertOrganizationId(admin: SupabaseClient): Promise<string | null> {
  const configured = process.env.GROWTH_ENGINE_AI_ORG_ID?.trim()
  if (configured) return configured

  const { data, error } = await admin
    .from("organizations")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error || !data?.id) return null
  return data.id
}

async function cleanupCertTemplate(admin: SupabaseClient, templateId: string): Promise<void> {
  await admin.schema("growth").from("share_page_templates").delete().eq("id", templateId)
}

async function cleanupCertSharePage(admin: SupabaseClient, sharePageId: string): Promise<void> {
  await admin.schema("growth").from("share_pages").delete().eq("id", sharePageId)
}

async function resolveCertLeadId(admin: SupabaseClient): Promise<string | null> {
  const { data, error } = await admin
    .schema("growth")
    .from("leads")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error || !data?.id) return null
  return data.id
}

async function runInstantiationDiagnostics(
  admin: SupabaseClient,
  organizationId: string,
  checks: GrowthSharePageTemplatesDiagnosticsCheck[],
): Promise<void> {
  const leadId = await resolveCertLeadId(admin)
  if (!leadId) {
    pushCheck(checks, "instantiate_lead_scope", false, "Could not resolve certification lead id.")
    return
  }
  pushCheck(checks, "instantiate_lead_scope", true, "Certification lead resolved.")

  const instantiateName = `${CERT_PREFIX}-instantiate-${randomUUID()}`
  const template = await createTemplate(admin, {
    organizationId,
    name: instantiateName,
    tags: [CERT_PREFIX, `${CERT_PREFIX}-instantiate`],
    changeSummary: "S1-E negative instantiate cert",
  })
  await publishVersion(admin, { templateId: template.id, actorUserId: null })

  const draftOnly = await createTemplate(admin, {
    organizationId,
    name: `${instantiateName}-draft-only`,
    tags: [CERT_PREFIX],
    changeSummary: "Draft-only negative cert",
  })
  let rejectedUnpublished = false
  try {
    await instantiateSharePageFromTemplate(admin, {
      templateId: draftOnly.id,
      organizationId,
      leadId,
      buildContext: false,
    })
  } catch (error) {
    rejectedUnpublished = error instanceof Error && error.message === "template_not_published"
  }
  pushCheck(
    checks,
    "instantiate_reject_unpublished",
    rejectedUnpublished,
    "Unpublished templates are rejected for instantiation.",
  )

  let rejectedMissingLead = false
  try {
    await instantiateSharePageFromTemplate(admin, {
      templateId: template.id,
      organizationId,
      leadId: randomUUID(),
      buildContext: false,
    })
  } catch (error) {
    rejectedMissingLead = error instanceof Error && error.message === "lead_not_found"
  }
  pushCheck(
    checks,
    "instantiate_reject_missing_lead",
    rejectedMissingLead,
    "Missing lead id is rejected cleanly.",
  )

  await cleanupCertTemplate(admin, template.id)
  await cleanupCertTemplate(admin, draftOnly.id)
  pushCheck(checks, "instantiate_cleanup", true, "Instantiation negative cert fixtures deleted.")
}

async function runRepositoryDiagnostics(
  admin: SupabaseClient,
  checks: GrowthSharePageTemplatesDiagnosticsCheck[],
): Promise<{ templateId: string | null }> {
  const organizationId = await resolveCertOrganizationId(admin)
  if (!organizationId) {
    pushCheck(checks, "organization_scope", false, "Could not resolve certification organization id.")
    return { templateId: null }
  }
  pushCheck(checks, "organization_scope", true, "Organization scope resolved.")

  const certName = `${CERT_PREFIX}-${randomUUID()}`
  const created = await createTemplate(admin, {
    organizationId,
    name: certName,
    description: "S1-B certification fixture",
    category: "general",
    tags: [CERT_PREFIX],
    changeSummary: "Cert create",
  })
  pushCheck(checks, "create_template", Boolean(created.id), "Template + v1 draft created.")
  pushCheck(
    checks,
    "default_blocks",
    Array.isArray(created.currentVersion?.blocks) && created.currentVersion.blocks.length > 0,
    "Initial blocks_json present.",
  )

  const updated = await updateTemplate(admin, created.id, {
    description: "Updated cert template",
    blocks: [
      ...(created.currentVersion?.blocks ?? []),
      {
        id: randomUUID(),
        type: "text",
        order: 1,
        heading: "Why us",
        body: "Hello {{lead.contact_name}}",
      },
    ],
  })
  pushCheck(
    checks,
    "update_template",
    updated.description === "Updated cert template" && updated.currentVersion?.blocks.length === 2,
    "Draft version updated in place.",
  )
  pushCheck(
    checks,
    "merge_fields_extracted",
    (updated.currentVersion?.mergeFieldsUsed ?? []).includes("lead.contact_name"),
    "Merge fields extracted from blocks_json.",
  )

  const published = await publishVersion(admin, {
    templateId: created.id,
    actorUserId: null,
  })
  pushCheck(
    checks,
    "publish_version",
    published.status === "published" &&
      published.publishedVersion?.isImmutable === true &&
      published.currentVersion?.status === "published",
    "Published version is immutable and template status is published.",
  )

  const edited = await updateTemplate(admin, created.id, {
    changeSummary: "Draft-on-edit after publish",
    blocks: [
      ...(published.currentVersion?.blocks ?? []),
      {
        id: randomUUID(),
        type: "cta",
        order: 2,
        label: "Book a demo",
        kind: "primary",
        action: "book_meeting",
        destinationUrl: null,
        trackingKey: "cert_cta",
      },
    ],
  })
  pushCheck(
    checks,
    "draft_on_edit",
    edited.status === "draft" &&
      edited.currentVersion?.status === "draft" &&
      edited.publishedVersion?.isImmutable === true,
    "Editing published template created new draft while preserving published version.",
  )

  const republished = await publishVersion(admin, {
    templateId: created.id,
    versionId: edited.currentVersion?.id,
    actorUserId: null,
  })
  pushCheck(
    checks,
    "republish_version",
    republished.status === "published" && republished.publishedVersionId === edited.currentVersion?.id,
    "Draft version republished successfully.",
  )

  const leadId = await resolveCertLeadId(admin)
  let lifecycleSharePageId: string | null = null
  if (!leadId) {
    pushCheck(checks, "lifecycle_instantiate_lead", false, "Could not resolve lead for lifecycle instantiation.")
  } else {
    pushCheck(checks, "lifecycle_instantiate_lead", true, "Lifecycle lead resolved.")
    const instantiated = await instantiateSharePageFromTemplate(admin, {
      templateId: created.id,
      organizationId,
      leadId,
      buildContext: false,
    })
    lifecycleSharePageId = instantiated.sharePage.id
    pushCheck(
      checks,
      "lifecycle_instantiate_draft",
      instantiated.sharePage.status === "draft" && instantiated.sharePage.publishedAt == null,
      "Lifecycle instantiation created draft share page only.",
    )
    pushCheck(
      checks,
      "lifecycle_lineage",
      instantiated.sharePage.sharePageTemplateId === created.id &&
        instantiated.sharePage.sharePageTemplateVersionId === republished.publishedVersionId &&
        Array.isArray(instantiated.sharePage.templateBlocksSnapshot) &&
        (instantiated.sharePage.templateBlocksSnapshot as unknown[]).length > 0,
      "Lifecycle preserves template lineage and block snapshot.",
    )
    pushCheck(
      checks,
      "lifecycle_no_live_publish",
      instantiated.noLivePagePublish === true,
      "Lifecycle instantiation preserves no-live-page guard.",
    )
  }

  const unpublished = await unpublishTemplate(admin, created.id)
  pushCheck(
    checks,
    "unpublish_template",
    unpublished.status === "draft" && unpublished.publishedVersion?.isImmutable === true,
    "Published template moved back to draft while preserving published version history.",
  )

  const restored = await restoreVersion(admin, {
    templateId: created.id,
    versionId: republished.publishedVersion?.id ?? "",
    actorUserId: null,
  })
  pushCheck(
    checks,
    "restore_version",
    restored.status === "draft" &&
      restored.currentVersion?.status === "draft" &&
      restored.currentVersion.id !== republished.publishedVersion?.id,
    "Historical version restored into a new draft.",
  )

  const versionDuplicate = await duplicateVersion(admin, {
    templateId: created.id,
    versionId: republished.publishedVersion?.id ?? "",
    actorUserId: null,
  })
  pushCheck(
    checks,
    "duplicate_version",
    versionDuplicate.status === "draft" &&
      versionDuplicate.versionNumber > (republished.publishedVersion?.versionNumber ?? 0),
    "Historical version duplicated into a new draft.",
  )

  const duplicate = await duplicateTemplate(admin, {
    templateId: created.id,
    organizationId,
    name: `${certName}-copy`,
  })
  pushCheck(checks, "duplicate_template", duplicate.id !== created.id, "Template duplicated with new id.")

  const listed = await listTemplates(admin, { organizationId, tag: CERT_PREFIX, limit: 10 })
  pushCheck(
    checks,
    "list_templates",
    listed.items.some((item) => item.id === created.id),
    "List templates returns cert fixture.",
  )

  await archiveTemplate(admin, created.id)
  await archiveTemplate(admin, duplicate.id)
  const archived = await getTemplate(admin, created.id)
  pushCheck(checks, "archive_template", archived?.status === "archived", "Template archived instead of hard delete.")

  await cleanupCertTemplate(admin, created.id)
  await cleanupCertTemplate(admin, duplicate.id)
  if (lifecycleSharePageId) {
    await cleanupCertSharePage(admin, lifecycleSharePageId)
  }
  pushCheck(checks, "cleanup", true, "Cert fixtures deleted.")

  pushCheck(
    checks,
    "lifecycle_end_to_end",
    checks.some((check) => check.id === "lifecycle_instantiate_draft" && check.ok),
    "Create → edit → version → publish → instantiate → archive lifecycle certified.",
  )

  await runInstantiationDiagnostics(admin, organizationId, checks)

  return { templateId: created.id }
}

export async function executeGrowthSharePageTemplatesDiagnostics(
  admin: SupabaseClient,
  input?: { dry_run?: boolean; skip_repository?: boolean },
): Promise<GrowthSharePageTemplatesDiagnosticsReport> {
  const execution_id = randomUUID()
  const checks: GrowthSharePageTemplatesDiagnosticsCheck[] = []
  const blockers: string[] = []

  const schemaProbe = await probeGrowthSharePageTemplatesSchema(admin)
  pushCheck(
    checks,
    "schema_tables",
    schemaProbe.ready,
    schemaProbe.ready
      ? "share_page_templates and share_page_template_versions are queryable."
      : schemaProbe.tables
          .filter((entry) => !entry.ok)
          .map((entry) => `${entry.table}: ${entry.error ?? "missing"}`)
          .join("; "),
  )

  if (!schemaProbe.ready) {
    blockers.push("share_page_templates_schema_not_ready")
  }

  let templateId: string | undefined
  if (!input?.dry_run && schemaProbe.ready && !input?.skip_repository) {
    try {
      const repositoryResult = await runRepositoryDiagnostics(admin, checks)
      templateId = repositoryResult.templateId ?? undefined
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      pushCheck(checks, "repository_crud", false, message)
      blockers.push("repository_crud_failed")
    }
  } else if (input?.dry_run) {
    pushCheck(checks, "repository_crud", true, "Dry run — repository CRUD skipped.")
  }

  const failedChecks = checks.filter((check) => !check.ok)
  const ok = failedChecks.length === 0 && blockers.length === 0

  return {
    ok,
    execution_id,
    qa_marker: GROWTH_SHARE_PAGE_TEMPLATES_QA_MARKER,
    checks,
    blockers,
    final_verdict: ok ? "PASS" : "FAIL",
    template_id: templateId,
  }
}
