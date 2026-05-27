import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  fetchInboxAssignmentSettings,
  listInboxAssignmentRules,
  upsertInboxAssignmentRules,
} from "@/lib/growth/inbox-team-ownership/inbox-assignment-rules-repository"
import { isGrowthInboxTeamOwnershipSchemaReady } from "@/lib/growth/inbox-team-ownership/inbox-team-ownership-schema-health"
import {
  GROWTH_INBOX_ASSIGNMENT_RULE_TYPES,
  GROWTH_INBOX_TEAM_OWNERSHIP_PRIVACY_NOTE,
} from "@/lib/growth/inbox-team-ownership/inbox-team-ownership-types"

export const runtime = "nodejs"

const RuleSchema = z.object({
  id: z.string().uuid().optional(),
  enabled: z.boolean().optional(),
  priorityOrder: z.number().int().min(0).max(10000).optional(),
  ruleType: z.enum(GROWTH_INBOX_ASSIGNMENT_RULE_TYPES).optional(),
  classification: z.string().trim().max(80).nullable().optional(),
  priorityTier: z.string().trim().max(40).nullable().optional(),
  targetUserId: z.string().uuid().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
})

const PostSchema = z.object({
  settings: z
    .object({
      autoAssignEnabled: z.boolean().optional(),
      slaAlertsEnabled: z.boolean().optional(),
    })
    .optional(),
  rules: z.array(RuleSchema).optional(),
})

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthInboxTeamOwnershipSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete", message: "Apply inbox team ownership migration." }, { status: 503 })
  }

  try {
    const [settings, rules] = await Promise.all([
      fetchInboxAssignmentSettings(access.admin),
      listInboxAssignmentRules(access.admin),
    ])
    return NextResponse.json({ ok: true, settings, rules, privacy_note: GROWTH_INBOX_TEAM_OWNERSHIP_PRIVACY_NOTE })
  } catch {
    return NextResponse.json({ error: "fetch_failed", message: "Could not load inbox assignment rules." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  if (!(await isGrowthInboxTeamOwnershipSchemaReady(access.admin))) {
    return NextResponse.json({ error: "growth_schema_incomplete", message: "Apply inbox team ownership migration." }, { status: 503 })
  }

  const parsed = PostSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid assignment rules payload." }, { status: 400 })
  }

  try {
    const result = await upsertInboxAssignmentRules(access.admin, {
      settings: parsed.data.settings
        ? { ...parsed.data.settings, updatedBy: access.userId }
        : undefined,
      rules: parsed.data.rules,
    })
    return NextResponse.json({ ok: true, ...result, privacy_note: GROWTH_INBOX_TEAM_OWNERSHIP_PRIVACY_NOTE })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save inbox assignment rules."
    return NextResponse.json({ error: "save_failed", message }, { status: 500 })
  }
}
