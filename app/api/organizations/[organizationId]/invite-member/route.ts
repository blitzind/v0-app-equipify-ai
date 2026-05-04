import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"
import { createServiceRoleClient } from "@/lib/supabase/admin"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type Body = {
  email?: string
  fullName?: string
}

export async function POST(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params

  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "invalid_organization", message: "Invalid organization." }, { status: 400 })
  }

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "Invalid request body." }, { status: 400 })
  }

  const emailRaw = typeof body.email === "string" ? body.email.trim() : ""
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : ""

  if (!emailRaw || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    return NextResponse.json({ error: "invalid_email", message: "Enter a valid email address." }, { status: 400 })
  }

  if (!fullName) {
    return NextResponse.json({ error: "invalid_name", message: "Full name is required." }, { status: 400 })
  }

  const email = emailRaw.toLowerCase()

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            /* ignore read-only cookie context */
          }
        },
      },
    },
  )

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser()

  if (userErr || !user) {
    return NextResponse.json({ error: "unauthorized", message: "Sign in to invite team members." }, { status: 401 })
  }

  const { data: callerRow, error: callerErr } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle()

  if (callerErr || !callerRow) {
    return NextResponse.json({ error: "forbidden", message: "You are not a member of this organization." }, { status: 403 })
  }

  if (callerRow.role !== "owner" && callerRow.role !== "admin") {
    return NextResponse.json(
      { error: "forbidden", message: "Only owners and admins can invite technicians." },
      { status: 403 },
    )
  }

  const admin = createServiceRoleClient()
  if (!admin) {
    return NextResponse.json(
      {
        error: "invites_unavailable",
        message:
          "Invitations are not configured on this server (missing SUPABASE_SERVICE_ROLE_KEY). Ask your admin to add the member in Supabase or set the service role key for automated invites.",
      },
      { status: 503 },
    )
  }

  const origin =
    request.headers.get("x-forwarded-host") && request.headers.get("x-forwarded-proto")
      ? `${request.headers.get("x-forwarded-proto")}://${request.headers.get("x-forwarded-host")}`
      : request.headers.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"

  let targetUserId: string | null = null

  const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo: `${origin.replace(/\/$/, "")}/`,
  })

  if (!inviteErr && invited?.user?.id) {
    targetUserId = invited.user.id
  } else {
    const msg = inviteErr?.message ?? ""
    const existsHint =
      /already|registered|exists|duplicate/i.test(msg) ||
      inviteErr?.status === 422 ||
      inviteErr?.code === "email_exists"

    if (!existsHint) {
      return NextResponse.json(
        {
          error: "invite_failed",
          message: inviteErr?.message ?? "Could not send invitation.",
        },
        { status: 400 },
      )
    }

    const { data: prof, error: profErr } = await admin.from("profiles").select("id").eq("email", email).maybeSingle()

    if (profErr || !prof?.id) {
      return NextResponse.json(
        {
          error: "user_lookup_failed",
          message:
            "That email may already be registered. If they have an account, ask them to sign in; otherwise contact support.",
        },
        { status: 400 },
      )
    }

    targetUserId = prof.id

    await admin
      .from("profiles")
      .update({ full_name: fullName, updated_at: new Date().toISOString() })
      .eq("id", targetUserId)
  }

  if (!targetUserId) {
    return NextResponse.json({ error: "internal", message: "Could not resolve user." }, { status: 500 })
  }

  if (targetUserId === user.id) {
    return NextResponse.json({ error: "invalid_target", message: "You cannot invite yourself." }, { status: 400 })
  }

  const { data: dup } = await admin
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("user_id", targetUserId)
    .maybeSingle()

  if (dup) {
    return NextResponse.json({
      ok: true,
      alreadyMember: true,
      userId: targetUserId,
      message: "This person is already on the team.",
    })
  }

  const { error: omErr } = await admin.from("organization_members").insert({
    organization_id: organizationId,
    user_id: targetUserId,
    role: "tech",
    status: "invited",
    invited_by: user.id,
  })

  if (omErr) {
    return NextResponse.json(
      { error: "membership_failed", message: omErr.message ?? "Could not add organization membership." },
      { status: 400 },
    )
  }

  return NextResponse.json({
    ok: true,
    userId: targetUserId,
    message: "Invitation sent. They will appear in the roster (invite pending until they accept).",
  })
}
