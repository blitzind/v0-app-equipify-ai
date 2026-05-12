import { NextResponse } from "next/server"
import { requireOrgMemberSession } from "@/lib/api/require-org-permission"
import {
  listPreparedActionsForOrg,
  listRecentPreparedActionRequesterIds,
} from "@/lib/aiden/actions/prepared-action-repository"
import { isAidenPreparedActionStatus, type AidenPreparedActionStatus } from "@/lib/aiden/actions/prepared-action-status"
import { extractPreviewWarningsFromPayload } from "@/lib/aiden/prepared-actions/extract-preview-warnings"
import {
  dashboardHrefForPreparedRecord,
  humanizeRecordType,
} from "@/lib/aiden/prepared-actions/prepared-action-record-links"
import { profileLabelsByUserIds } from "@/lib/prospects/member-profiles"
import { AIDEN_PREPARED_WORKSPACE_ACTION_IDS } from "@/lib/aiden/actions/action-types"
import { AIDEN_PREPARED_WORKSPACE_ACTION_RISK_LEVELS } from "@/lib/aiden/actions/action-risk"
import { UUID_RE, serializePreparedAction } from "@/lib/aiden/prepared-actions/prepared-actions-api-helpers"

export const runtime = "nodejs"

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function parseStatuses(url: URL): AidenPreparedActionStatus[] | undefined {
  const multi = url.searchParams.get("statuses")?.trim()
  if (multi) {
    const parts = multi
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    const valid = parts.filter((s): s is AidenPreparedActionStatus => isAidenPreparedActionStatus(s))
    return valid.length > 0 ? valid : undefined
  }
  const one = url.searchParams.get("status")?.trim()
  if (one && isAidenPreparedActionStatus(one)) return [one]
  return undefined
}

function dayStartIso(d: string): string {
  return `${d}T00:00:00.000Z`
}

function dayEndIso(d: string): string {
  return `${d}T23:59:59.999Z`
}

export async function GET(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization id." }, { status: 400 })
  }

  const gate = await requireOrgMemberSession(organizationId)
  if ("error" in gate) return gate.error

  const url = new URL(request.url)
  const limitRaw = url.searchParams.get("limit")
  const offsetRaw = url.searchParams.get("offset")
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined
  const offset = offsetRaw ? Number.parseInt(offsetRaw, 10) : undefined

  const statusList = parseStatuses(url)
  const actionIdRaw = url.searchParams.get("actionId")?.trim() ?? ""
  const actionId =
    actionIdRaw && (AIDEN_PREPARED_WORKSPACE_ACTION_IDS as readonly string[]).includes(actionIdRaw) ?
      actionIdRaw
    : undefined

  const riskLevelRaw = url.searchParams.get("riskLevel")?.trim() ?? ""
  const riskLevel =
    riskLevelRaw && (AIDEN_PREPARED_WORKSPACE_ACTION_RISK_LEVELS as readonly string[]).includes(riskLevelRaw) ?
      riskLevelRaw
    : undefined

  const requestedByRaw = url.searchParams.get("requestedBy")?.trim() ?? ""
  const requestedBy = UUID_RE.test(requestedByRaw) ? requestedByRaw : undefined

  const createdAfter = url.searchParams.get("createdAfter")?.trim() ?? ""
  const createdBefore = url.searchParams.get("createdBefore")?.trim() ?? ""
  const createdAfterIso = DATE_RE.test(createdAfter) ? dayStartIso(createdAfter) : undefined
  const createdBeforeIso = DATE_RE.test(createdBefore) ? dayEndIso(createdBefore) : undefined

  const includeRequesters = url.searchParams.get("include")?.split(",").includes("requesters") ?? false

  const { data, error } = await listPreparedActionsForOrg(gate.supabase, organizationId, {
    limit: Number.isFinite(limit) ? limit : undefined,
    offset: Number.isFinite(offset) ? offset : undefined,
    statuses: statusList,
    actionId,
    riskLevel,
    requestedBy,
    createdAfterIso,
    createdBeforeIso,
  })
  if (error) {
    return NextResponse.json({ error: "query_failed", message: error.message }, { status: 500 })
  }

  const labelIds = [...new Set(data.map((r) => r.requested_by).filter(Boolean))]
  const labelMap = await profileLabelsByUserIds(gate.supabase, labelIds)

  const items = data.map((row) => {
    const base = serializePreparedAction(row)
    const previewPayload = row.preview_payload as Record<string, unknown>
    const warnings = extractPreviewWarningsFromPayload(previewPayload)
    return {
      ...base,
      requestedByLabel: labelMap.get(row.requested_by) ?? null,
      sourceHref: dashboardHrefForPreparedRecord(row.source_record_type, row.source_record_id),
      targetHref: dashboardHrefForPreparedRecord(row.target_record_type, row.target_record_id),
      sourceRecordLabel: humanizeRecordType(row.source_record_type),
      targetRecordLabel: humanizeRecordType(row.target_record_type),
      previewWarnings: warnings,
    }
  })

  let requesterOptions: { id: string; label: string }[] | undefined
  if (includeRequesters) {
    const ridRes = await listRecentPreparedActionRequesterIds(gate.supabase, organizationId, 400)
    if (!ridRes.error && ridRes.data.length > 0) {
      const rm = await profileLabelsByUserIds(gate.supabase, ridRes.data)
      requesterOptions = ridRes.data.map((id) => ({ id, label: rm.get(id) ?? "Team member" }))
    } else {
      requesterOptions = []
    }
  }

  return NextResponse.json({
    items,
    ...(requesterOptions !== undefined ? { requesterOptions } : {}),
  })
}
