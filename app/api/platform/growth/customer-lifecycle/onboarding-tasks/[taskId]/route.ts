import { NextResponse } from "next/server"
import { z } from "zod"
import { requireGrowthEnginePlatformAccess } from "@/lib/growth/access"
import {
  completeGrowthCustomerOnboardingTask,
  skipGrowthCustomerOnboardingTask,
} from "@/lib/growth/customer-lifecycle/mutate-customer-onboarding"
import {
  GROWTH_CUSTOMER_LIFECYCLE_SCHEMA_SETUP_MESSAGE,
  isGrowthCustomerLifecycleSchemaReady,
} from "@/lib/growth/customer-lifecycle/customer-lifecycle-schema-health"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ taskId: string }> }

export async function PATCH(request: Request, context: RouteContext) {
  const access = await requireGrowthEnginePlatformAccess()
  if (!access.ok) return access.response

  const { taskId } = await context.params
  if (!(await isGrowthCustomerLifecycleSchemaReady(access.admin))) {
    return NextResponse.json(
      { error: "schema_not_ready", message: GROWTH_CUSTOMER_LIFECYCLE_SCHEMA_SETUP_MESSAGE },
      { status: 503 },
    )
  }

  const body = z
    .object({
      action: z.enum(["complete", "skip"]),
      outcome: z.string().optional(),
      reason: z.string().optional(),
    })
    .parse(await request.json().catch(() => ({})))

  const actor = { userId: access.userId, email: access.userEmail }

  try {
    if (body.action === "complete") {
      const result = await completeGrowthCustomerOnboardingTask(access.admin, {
        taskId,
        outcome: body.outcome ?? null,
        actor,
      })
      if (!result.ok) {
        return NextResponse.json({ ok: false, error: result.code, message: result.message }, { status: 400 })
      }
      return NextResponse.json({ ok: true, task: result.task, profile: result.profile })
    }

    const result = await skipGrowthCustomerOnboardingTask(access.admin, {
      taskId,
      reason: body.reason ?? null,
      actor,
    })
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.code, message: result.message }, { status: 400 })
    }
    return NextResponse.json({ ok: true, profile: result.profile })
  } catch {
    return NextResponse.json({ error: "update_failed", message: "Could not update onboarding task." }, { status: 500 })
  }
}
