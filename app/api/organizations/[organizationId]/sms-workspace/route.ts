import { NextResponse } from "next/server"
import { z } from "zod"
import type { SupabaseClient } from "@supabase/supabase-js"
import { UUID_RE } from "@/lib/aiden/prepared-actions/prepared-actions-shared"
import { getServiceRoleOrNull } from "@/lib/aiden/prepared-actions/prepared-actions-api-helpers"
import { requireOrgMemberSession, requireOrgPermission } from "@/lib/api/require-org-permission"
import {
  fetchWorkspaceSmsSettingsRow,
  looksLikeMissingSmsWorkspaceTablesError,
  upsertWorkspaceSmsSettings,
  workspaceSmsRowToDto,
} from "@/lib/sms/workspace-sms-repository.server"
import type { SmsComplianceStatus, SmsProviderKind } from "@/lib/sms/workspace-sms-types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ComplianceSchema = z.enum(["not_started", "pending_review", "approved", "rejected"])
const ProviderKindSchema = z.enum(["none", "twilio", "telnyx"])

const PatchSmsWorkspaceSchema = z
  .object({
    smsMasterEnabled: z.boolean().optional(),
    optInRequired: z.boolean().optional(),
    providerConfigured: z.boolean().optional(),
    providerKind: ProviderKindSchema.optional(),
    /** Owner may request review; cannot set `approved` from this API. */
    complianceStatus: ComplianceSchema.optional(),
    senderDisplayHint: z.string().max(120).nullable().optional(),
  })
  .superRefine((body, ctx) => {
    if (Object.keys(body).length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Provide at least one field to update." })
    }
    if (body.complianceStatus === "approved") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Approved compliance cannot be set from the app API.",
        path: ["complianceStatus"],
      })
    }
  })

async function smsWorkspaceJsonResponse(organizationId: string, supabase: SupabaseClient) {
  const { row, error, persistenceReady } = await fetchWorkspaceSmsSettingsRow(supabase, organizationId)
  if (error) {
    console.error("[sms-workspace GET]", { organizationId, message: error.message })
    return NextResponse.json({ error: "query_failed", message: "Could not load SMS workspace settings." }, { status: 500 })
  }
  const smsWorkspace = workspaceSmsRowToDto(row)
  return NextResponse.json(
    { smsWorkspace, meta: { smsPersistenceReady: persistenceReady } },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } },
  )
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization id." }, { status: 400 })
  }
  const gate = await requireOrgMemberSession(organizationId)
  if ("error" in gate) return gate.error
  return smsWorkspaceJsonResponse(organizationId, gate.supabase)
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization id." }, { status: 400 })
  }

  const gate = await requireOrgPermission(organizationId, "canManageWorkspaceSettings")
  if ("error" in gate) return gate.error

  const svc = getServiceRoleOrNull()
  if (!svc) {
    return NextResponse.json({ error: "server_misconfigured", message: "Server is not configured." }, { status: 503 })
  }

  let body: z.infer<typeof PatchSmsWorkspaceSchema>
  try {
    const raw = await request.json().catch(() => ({}))
    body = PatchSmsWorkspaceSchema.parse(raw)
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: "bad_request", message: "Check your SMS workspace settings and try again." },
        { status: 400 },
      )
    }
    return NextResponse.json({ error: "bad_request", message: "Invalid request body." }, { status: 400 })
  }

  const existing = await fetchWorkspaceSmsSettingsRow(svc, organizationId)
  if (existing.error) {
    console.error("[sms-workspace PATCH] load", { organizationId, message: existing.error.message })
    return NextResponse.json({ error: "query_failed", message: "Could not load current SMS settings." }, { status: 500 })
  }
  if (!existing.persistenceReady) {
    return NextResponse.json(
      {
        error: "not_configured",
        message: "SMS workspace storage is not available until migrations are applied.",
      },
      { status: 503 },
    )
  }

  const cur = workspaceSmsRowToDto(existing.row)
  const next = {
    smsMasterEnabled: body.smsMasterEnabled ?? cur.smsMasterEnabled,
    optInRequired: body.optInRequired ?? cur.optInRequired,
    providerKind: (body.providerKind ?? cur.providerKind) as SmsProviderKind,
    providerConfigured: body.providerConfigured ?? cur.providerConfigured,
    complianceStatus: (body.complianceStatus ?? cur.complianceStatus) as SmsComplianceStatus,
    transactionalOnly: true,
    senderDisplayHint: body.senderDisplayHint !== undefined ? body.senderDisplayHint : cur.senderDisplayHint,
  }

  const up = await upsertWorkspaceSmsSettings(svc, organizationId, next)
  if (up.error) {
    console.error("[sms-workspace PATCH] upsert", { organizationId, message: up.error.message })
    if (looksLikeMissingSmsWorkspaceTablesError(up.error)) {
      return NextResponse.json(
        { error: "not_configured", message: "SMS workspace storage is not set up on this server." },
        { status: 503 },
      )
    }
    return NextResponse.json({ error: "update_failed", message: "Could not save SMS workspace settings." }, { status: 500 })
  }

  return smsWorkspaceJsonResponse(organizationId, svc)
}
