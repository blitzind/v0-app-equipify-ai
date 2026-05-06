import { randomUUID } from "crypto"
import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/admin"
import { sendEmail } from "@/lib/email/resend"
import { insertTeamAuditEvent } from "@/lib/team-audit"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const VALID_ROLES = new Set(["admin", "manager", "tech", "viewer"])

type Body = {
  email?: string
  organizationId?: string
  role?: string
}

export async function POST(request: Request) {
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "Invalid request body." }, { status: 400 })
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
  const organizationId = typeof body.organizationId === "string" ? body.organizationId.trim() : ""
  const roleRaw = typeof body.role === "string" ? body.role.trim().toLowerCase() : "tech"
  const role = VALID_ROLES.has(roleRaw) ? roleRaw : "tech"

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "invalid_email", message: "Enter a valid email address." }, { status: 400 })
  }
  if (!UUID_RE.test(organizationId)) {
    return NextResponse.json({ error: "invalid_organization", message: "Invalid organization." }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthorized", message: "Sign in required." }, { status: 401 })
  }

  const { data: member } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle()
  if (!member || (member.role !== "owner" && member.role !== "admin")) {
    return NextResponse.json({ error: "forbidden", message: "Only owners and admins can invite users." }, { status: 403 })
  }

  const admin = createServiceRoleClient()
  if (!admin) {
    return NextResponse.json({ error: "invites_unavailable", message: "Invites are not configured on this server." }, { status: 503 })
  }

  const token = randomUUID()
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

  const { data: org } = await admin
    .from("organizations")
    .select("name")
    .eq("id", organizationId)
    .maybeSingle()
  const organizationName = (org as { name?: string } | null)?.name?.trim() || "Equipify"

  const { data: insertedInvite, error: inviteErr } = await admin
    .from("organization_invites")
    .insert({
      email,
      organization_id: organizationId,
      role,
      token,
      expires_at: expiresAt,
      invited_by: user.id,
      status: "pending",
    })
    .select("id")
    .single()
  if (inviteErr) {
    return NextResponse.json({ error: "invite_failed", message: inviteErr.message }, { status: 400 })
  }

  await insertTeamAuditEvent({
    organizationId,
    action: "member_invited",
    actorUserId: user.id,
    recordType: "invite",
    recordId: insertedInvite.id as string,
    metadata: { email, role },
  })

  const appBaseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.equipify.ai").replace(/\/$/, "")
  const inviteLink = `${appBaseUrl}/onboarding?inviteToken=${encodeURIComponent(token)}`

  const emailSend = await sendEmail({
    to: email,
    subject: `You're invited to join ${organizationName} on Equipify`,
    html: `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#111827">
        <h2 style="margin:0 0 12px">You're invited to Equipify</h2>
        <p style="margin:0 0 12px">You've been invited to join <strong>${organizationName}</strong>.</p>
        <p style="margin:0 0 16px">Click below to create your account and join the workspace.</p>
        <p style="margin:0 0 20px">
          <a href="${inviteLink}" style="background:#2563eb;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;display:inline-block">
            Accept invite
          </a>
        </p>
        <p style="font-size:12px;color:#6b7280;margin:0">This link expires in 48 hours.</p>
      </div>
    `,
    text: `You've been invited to join ${organizationName} on Equipify.\n\nAccept invite: ${inviteLink}\n\nThis link expires in 48 hours.`,
  })
  if (!emailSend.ok) {
    return NextResponse.json(
      {
        error: "email_failed",
        message: emailSend.error,
        inviteLink,
      },
      { status: emailSend.code === "config" ? 503 : 502 },
    )
  }

  return NextResponse.json({
    ok: true,
    inviteLink,
    expiresAt,
  })
}
