import { NextResponse } from "next/server"
import { z } from "zod"
import { requireOrgMemberSession } from "@/lib/api/require-org-permission"
import { isOnboardingProductEventKey } from "@/lib/onboarding-analytics/event-keys"
import { recordOnboardingProductEvent } from "@/lib/onboarding-analytics/record-onboarding-product-event"
import { normalizeIndustryKey } from "@/lib/demo-seeding/profiles"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const BodySchema = z.object({
  eventKey: z.string().min(1).max(80),
  /** Optional slug (e.g. golden path action id) — no UUIDs. */
  subjectKey: z.string().max(80).regex(/^[a-z0-9_]+$/i).optional().nullable(),
})

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "bad_request", message: "Invalid organization." }, { status: 400 })
  }

  const gate = await requireOrgMemberSession(organizationId)
  if ("error" in gate) return gate.error

  let body: z.infer<typeof BodySchema>
  try {
    body = BodySchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "Invalid request body." }, { status: 400 })
  }

  if (!isOnboardingProductEventKey(body.eventKey)) {
    return NextResponse.json({ error: "bad_request", message: "Unknown event key." }, { status: 400 })
  }

  const {
    data: { user: authUser },
  } = await gate.supabase.auth.getUser()
  const userId = authUser?.id
  if (!userId) {
    return NextResponse.json({ error: "unauthorized", message: "No authenticated user." }, { status: 401 })
  }

  const { data: orgRow } = await gate.supabase
    .from("organizations")
    .select("industry")
    .eq("id", organizationId)
    .maybeSingle()
  const vertical = normalizeIndustryKey((orgRow as { industry?: string | null } | null)?.industry ?? undefined)

  await recordOnboardingProductEvent({
    organizationId,
    userId,
    eventKey: body.eventKey,
    verticalKey: vertical,
    subjectKey: body.subjectKey ?? null,
  })

  return NextResponse.json({ ok: true })
}
