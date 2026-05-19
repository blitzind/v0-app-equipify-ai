import { NextResponse } from "next/server"
import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import { isPlatformAdminEmail } from "@/lib/platform-admin-policy"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { bulkDeactivateTechnicians } from "@/lib/technicians/bulk-deactivate-technicians"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const MAX_BULK_DEACTIVATE = 100

type Body = {
  userIds?: string[]
}

function jsonError(message: string, status: number, code = "forbidden") {
  return NextResponse.json({ error: code, message }, { status })
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  try {
    const { organizationId } = await context.params
    if (!UUID_RE.test(organizationId)) {
      return jsonError("Invalid organization.", 400, "bad_request")
    }

    let body: Body
    try {
      body = (await request.json()) as Body
    } catch {
      return jsonError("Invalid JSON body.", 400, "bad_request")
    }

    const userIdsRaw = Array.isArray(body.userIds) ? body.userIds : []
    const userIds = [
      ...new Set(userIdsRaw.map((id) => (typeof id === "string" ? id.trim() : "")).filter(Boolean)),
    ]

    if (userIds.length === 0) {
      return jsonError("Select at least one technician to deactivate.", 400, "bad_request")
    }
    if (userIds.length > MAX_BULK_DEACTIVATE) {
      return jsonError(
        `You can deactivate up to ${MAX_BULK_DEACTIVATE} technicians at a time.`,
        400,
        "bad_request",
      )
    }
    if (!userIds.every((id) => UUID_RE.test(id))) {
      return jsonError("One or more selected technicians are invalid.", 400, "bad_request")
    }

    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.email) {
      return jsonError("Sign in required.", 401, "unauthorized")
    }

    const platformAdmin = isPlatformAdminEmail(user.email)
    let actorIsOwner = false
    let actorIsAdmin = false

    if (!platformAdmin) {
      const { data: me, error: meErr } = await supabase
        .from("organization_members")
        .select("role")
        .eq("organization_id", organizationId)
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle()

      if (meErr || !me) {
        return jsonError("You are not a member of this organization.", 403)
      }
      if (me.role !== "owner" && me.role !== "admin") {
        return jsonError("Only owners and admins can deactivate technicians.", 403)
      }
      actorIsOwner = me.role === "owner"
      actorIsAdmin = me.role === "admin"
    } else {
      actorIsOwner = true
    }

    const admin = createServiceRoleSupabaseClient()
    const writeClient = platformAdmin ? admin : supabase

    const { results } = await bulkDeactivateTechnicians({
      writeClient,
      adminClient: admin,
      organizationId,
      userIds,
      actorUserId: user.id,
      actorIsOwner,
      actorIsAdmin,
    })

    const succeededIds = results.filter((r) => r.ok).map((r) => r.id)
    const failedIds = results.filter((r) => !r.ok).map((r) => r.id)

    return NextResponse.json({
      ok: true,
      succeededCount: succeededIds.length,
      failedCount: failedIds.length,
      failedIds,
    })
  } catch (e) {
    console.error("[PATCH technicians/bulk-deactivate]", e)
    return jsonError("Unexpected error.", 500, "internal_error")
  }
}
