import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  listGrowthAiCopilotPlaybookApprovedRules,
  listGrowthAiCopilotPlaybookDraftRules,
  listGrowthAiCopilotPlaybookEffectivenessSummary,
  listGrowthAiCopilotPlaybookSources,
} from "@/lib/growth/ai-copilot-playbook-repository"
import { GROWTH_AI_COPILOT_PLAYBOOK_SOURCE_KINDS } from "@/lib/growth/ai-copilot-playbook-types"

export const runtime = "nodejs"

export async function GET() {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  try {
    const [sources, draftRules, approvedRules, effectiveness] = await Promise.all([
      listGrowthAiCopilotPlaybookSources(access.admin, 50),
      listGrowthAiCopilotPlaybookDraftRules(access.admin, { status: "draft", limit: 50 }),
      listGrowthAiCopilotPlaybookApprovedRules(access.admin, 100),
      listGrowthAiCopilotPlaybookEffectivenessSummary(access.admin, 100),
    ])

    return NextResponse.json({
      ok: true,
      sources,
      draftRules,
      approvedRules,
      effectiveness,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "fetch_failed", message }, { status: 500 })
  }
}

const CreateSourceSchema = z.object({
  title: z.string().min(3).max(200),
  sourceKind: z.enum(GROWTH_AI_COPILOT_PLAYBOOK_SOURCE_KINDS),
  sourceUrl: z.string().url().optional().nullable(),
  rawContent: z.string().min(20).max(250_000).optional().nullable(),
  trainerProfile: z
    .object({
      name: z.string().optional(),
      role: z.string().optional(),
      organization: z.string().optional(),
      styleNotes: z.string().optional(),
    })
    .optional(),
  industryScope: z
    .object({
      appliesGlobally: z.boolean().optional(),
      industries: z.array(z.string()).optional(),
      tags: z.array(z.string()).optional(),
    })
    .optional(),
})

export async function POST(request: Request) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const rawBody = await request.json().catch(() => null)
  const parsed = CreateSourceSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", message: "Invalid playbook source payload." }, { status: 400 })
  }

  try {
    const { insertGrowthAiCopilotPlaybookSource } = await import("@/lib/growth/ai-copilot-playbook-repository")
    const source = await insertGrowthAiCopilotPlaybookSource(access.admin, {
      title: parsed.data.title,
      sourceKind: parsed.data.sourceKind,
      sourceUrl: parsed.data.sourceUrl ?? null,
      rawContent: parsed.data.rawContent ?? null,
      trainerProfile: parsed.data.trainerProfile,
      industryScope: parsed.data.industryScope,
      createdBy: access.userId,
    })
    return NextResponse.json({ ok: true, source })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: "create_failed", message }, { status: 500 })
  }
}
