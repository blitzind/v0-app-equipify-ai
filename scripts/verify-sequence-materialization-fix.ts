/**
 * One-shot: verify materialization with GROWTH_ENGINE_AI_ORG_ID set.
 * Run: GROWTH_ENGINE_AI_ORG_ID=00757488-1026-44a5-aac4-269533ac21be pnpm exec tsx scripts/verify-sequence-materialization-fix.ts
 */
import { createClient } from "@supabase/supabase-js"
import { bootstrapVerifiedChannelsCertEnv } from "../lib/growth/qa/verified-channels-cert-env-bootstrap"

const ENROLLMENT_ID = "d5fa5558-08ff-4504-ab55-a925e26e6c29"
const BLITZ_ORG_ID = "00757488-1026-44a5-aac4-269533ac21be"

const boot = bootstrapVerifiedChannelsCertEnv()
if (!boot) {
  console.error(JSON.stringify({ ok: false, error: "no supabase boot" }))
  process.exit(1)
}

if (!process.env.GROWTH_ENGINE_AI_ORG_ID?.trim()) {
  process.env.GROWTH_ENGINE_AI_ORG_ID = BLITZ_ORG_ID
}

async function main(): Promise<void> {
  const admin = createClient(boot.url, boot.jwt, { auth: { persistSession: false } })
  const { getGrowthAiProvider } = await import("../lib/growth/ai-copilot-provider")
  const { materializeGrowthSequenceEnrollmentStep } = await import(
    "../lib/growth/sequence-enrollment/sequence-enrollment-orchestrator"
  )

  const provider = getGrowthAiProvider()
  const health = await provider.health()

  const { data: adminProfile } = await admin
    .from("profiles")
    .select("id, email")
    .ilike("email", "%blitz%")
    .limit(1)
    .maybeSingle()

  const actingUserId = adminProfile?.id ?? "631caf46-ff1d-4c12-a8aa-7c7c8953e9e4"
  const actingUserEmail = adminProfile?.email ?? "cert@equipify.internal"

  const before = await admin
    .schema("growth")
    .from("sequence_enrollment_steps")
    .select("status, generation_id")
    .eq("enrollment_id", ENROLLMENT_ID)
    .eq("step_order", 1)
    .maybeSingle()

  let materialize: Record<string, unknown> = { ok: true }
  try {
    await materializeGrowthSequenceEnrollmentStep(admin, {
      enrollmentId: ENROLLMENT_ID,
      stepOrder: 1,
      actingUserId,
      actingUserEmail,
    })
  } catch (error) {
    materialize = { ok: false, code: error instanceof Error ? error.message : String(error) }
  }

  const after = await admin
    .schema("growth")
    .from("sequence_enrollment_steps")
    .select("status, generation_id")
    .eq("enrollment_id", ENROLLMENT_ID)
    .eq("step_order", 1)
    .maybeSingle()

  console.log(
    JSON.stringify(
      {
        ok: after?.status === "draft_created" && Boolean(after?.generation_id),
        provider: { id: provider.id, health },
        org_id: process.env.GROWTH_ENGINE_AI_ORG_ID,
        acting_user_id: actingUserId,
        before,
        materialize,
        after,
      },
      null,
      2,
    ),
  )

  if (after?.status !== "draft_created") process.exit(1)
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }))
  process.exit(1)
})
