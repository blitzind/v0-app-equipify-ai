/**
 * GE-AUTO-2I — Link sender profile email to operator org member (production one-off).
 * Run: node -r ./scripts/server-only-shim.cjs --import tsx scripts/ge-auto-2i-link-sender-owner.ts
 */
import { createClient } from "@supabase/supabase-js"
import {
  fetchSupabaseServiceRoleKeyFromCli,
  resolveLinkedSupabaseProjectRef,
  resolveSupabaseUrlForProjectRef,
} from "../lib/growth/qa/supabase-cli-linked-project-bootstrap"

const ORG_ID = "5876176a-61ec-4532-ad99-0c31482d5a91"
const SENDER_EMAIL = process.env.GE_AUTO_2I_SENDER_EMAIL?.trim() || "mike@goequipify.com"

async function main(): Promise<void> {
  const ref = resolveLinkedSupabaseProjectRef()
  if (!ref) throw new Error("linked_supabase_project_ref_missing")
  const jwt = fetchSupabaseServiceRoleKeyFromCli(ref)
  if (!jwt) throw new Error("service_role_key_unavailable")

  const url = resolveSupabaseUrlForProjectRef(ref)
  process.env.NEXT_PUBLIC_SUPABASE_URL = url
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "ge-auto-2i-bootstrap-anon"
  process.env.SUPABASE_SERVICE_ROLE_KEY = jwt

  const admin = createClient(url, jwt, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id, email")
    .ilike("email", SENDER_EMAIL)
    .maybeSingle()

  let userId = existingProfile?.id ?? null
  if (!userId) {
    const created = await admin.auth.admin.createUser({
      email: SENDER_EMAIL,
      email_confirm: true,
      password: `GeAuto2I!${crypto.randomUUID().slice(0, 8)}`,
      user_metadata: { full_name: "Mike GoEquipify" },
    })
    if (created.error) throw new Error(`createUser: ${created.error.message}`)
    userId = created.data.user?.id ?? null
  }

  if (!userId) throw new Error("user_id_missing")

  const { data: profile } = await admin.from("profiles").select("id, email").eq("id", userId).maybeSingle()
  if (!profile?.email || profile.email.toLowerCase() !== SENDER_EMAIL.toLowerCase()) {
    const { error: profileErr } = await admin.from("profiles").upsert({
      id: userId,
      email: SENDER_EMAIL,
      full_name: "Mike GoEquipify",
      updated_at: new Date().toISOString(),
    })
    if (profileErr) throw new Error(`profile_upsert: ${profileErr.message}`)
  }

  const { data: existingMember } = await admin
    .from("organization_members")
    .select("user_id, role, status")
    .eq("organization_id", ORG_ID)
    .eq("user_id", userId)
    .maybeSingle()

  if (!existingMember) {
    const { data: ownerRow } = await admin
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", ORG_ID)
      .eq("role", "owner")
      .limit(1)
      .maybeSingle()

    const { error: memberErr } = await admin.from("organization_members").insert({
      organization_id: ORG_ID,
      user_id: userId,
      role: "admin",
      status: "active",
      invited_by: ownerRow?.user_id ?? userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    if (memberErr) throw new Error(`member_insert: ${memberErr.message}`)
  }

  const { auditObjectiveActorContext } = await import(
    "../lib/growth/objectives/growth-objective-actor-resolution"
  )
  const audit = await auditObjectiveActorContext(admin, {
    id: "ge-auto-2i-sender-probe",
    organizationId: ORG_ID,
    ownerUserId: userId,
    title: "GE-AUTO-2I sender probe",
    description: null,
    objectiveType: "demos_booked",
    targetValue: 1,
    currentValue: 0,
    startDate: null,
    targetDate: null,
    status: "draft",
    priority: "high",
    autonomyLevel: "objective",
    safetyMode: "strict",
    plan: null,
    runtime: null,
    executionHistory: [],
    recentSignals: [],
    recommendations: [],
    eventSubscriptions: null,
    executionContext: null,
    emergencyStopActive: false,
    qa_marker: "growth-objective-ge-auto-2g-v1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })

  console.log(
    JSON.stringify(
      {
        ok: audit.ok,
        userId,
        email: SENDER_EMAIL,
        orgId: ORG_ID,
        audit,
      },
      null,
      2,
    ),
  )

  if (!audit.ok) process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
