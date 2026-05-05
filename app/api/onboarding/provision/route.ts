import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { seedDemoForIndustry } from "@/lib/demo-seeding/seed-engine"

type Body = {
  organizationId?: string | null
  organizationName?: string | null
  seedDemo?: boolean
  industry?: string | null
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
}

export async function POST(request: Request) {
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "Invalid request body." }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthorized", message: "Sign in required." }, { status: 401 })
  }

  const seedDemo = Boolean(body.seedDemo)
  let organizationId = typeof body.organizationId === "string" ? body.organizationId.trim() : ""

  if (organizationId) {
    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .in("status", ["active", "invited"])
      .maybeSingle()
    if (!membership) {
      return NextResponse.json(
        { error: "forbidden", message: "You do not have access to this organization." },
        { status: 403 },
      )
    }
  } else {
    const { data: memberships } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1)

    if (memberships?.[0]?.organization_id) {
      organizationId = memberships[0].organization_id
    } else {
      const baseName =
        (typeof body.organizationName === "string" ? body.organizationName.trim() : "") || "My Organization"
      const baseSlug = slugify(baseName) || `org-${user.id.slice(0, 8)}`
      let created: { id?: string } | null = null
      let lastError = "Unable to create organization."

      for (let i = 0; i < 3; i += 1) {
        const candidateSlug = i === 0 ? baseSlug : `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`
        const { data, error } = await supabase.rpc("create_organization_with_owner", {
          org_name: baseName,
          org_slug: candidateSlug,
        })
        if (!error && data && typeof data === "object") {
          created = data as { id?: string }
          break
        }
        lastError = error?.message ?? lastError
      }

      if (!created?.id) {
        return NextResponse.json(
          { error: "organization_create_failed", message: lastError },
          { status: 400 },
        )
      }
      organizationId = created.id
    }
  }

  await supabase
    .from("profiles")
    .update({ default_organization_id: organizationId, updated_at: new Date().toISOString() })
    .eq("id", user.id)

  let seeded = false
  let seedSkipped = false
  let techniciansSeeded = false
  let seededIndustry: string | null = null
  let seedCounts: Record<string, number> | null = null

  if (seedDemo) {
    try {
      const seedResult = await seedDemoForIndustry({
        supabase,
        organizationId,
        ownerUserId: user.id,
        industry: body.industry,
      })
      seededIndustry = seedResult.industry
      seeded = seedResult.seeded
      seedSkipped = seedResult.skipped
      techniciansSeeded = Boolean(seedResult.techniciansSeeded)
      seedCounts = (seedResult.counts ?? null) as Record<string, number> | null
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to seed demo data."
      return NextResponse.json(
        { error: "seed_failed", message, organizationId },
        { status: 400 },
      )
    }
  }

  return NextResponse.json({
    ok: true,
    organizationId,
    seeded,
    seedSkipped,
    seededIndustry,
    seedCounts,
    techniciansSeeded,
  })
}
