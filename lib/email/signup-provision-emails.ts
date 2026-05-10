import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { getPublicAppOrigin, getSignupInternalNotifyRecipient } from "@/lib/email/config"
import { sendEmail } from "@/lib/email/resend"

const WELCOME_META_KEY = "signup_welcome_email_org_id"
const ADMIN_META_KEY = "signup_admin_notify_org_id"

function logSignupEmail(payload: Record<string, unknown>) {
  try {
    console.info(JSON.stringify({ source: "signup-provision-email", ...payload }))
  } catch {
    /* best-effort */
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function buildWelcomeContent(args: { fullName: string | null; dashboardUrl: string }) {
  const safeName =
    args.fullName && args.fullName.trim() ? args.fullName.trim().slice(0, 120) : null
  const greeting = safeName ? `Hi ${safeName},` : "Hi,"
  const greetingHtml = safeName ? `Hi ${escapeHtml(safeName)},` : "Hi,"
  const subject = "Welcome to Equipify — your workspace is ready"
  const text = [
    greeting,
    "",
    "Your Equipify workspace is set up and ready to use.",
    "",
    `Open your dashboard: ${args.dashboardUrl}`,
    "",
    "What to do next:",
    "- Explore your workspace and invite teammates from Settings.",
    "- Add customers and equipment when you are ready.",
    "",
    "If you did not create this account, you can ignore this email or contact support.",
    "",
    "— The Equipify team",
  ].join("\n")
  const html = `
<!DOCTYPE html>
<html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#111;max-width:560px;">
  <p>${greetingHtml}</p>
  <p>Your <strong>Equipify</strong> workspace is set up and ready to use.</p>
  <p><a href="${args.dashboardUrl}" style="color:#2563eb;">Open your dashboard</a></p>
  <p><strong>What to do next</strong></p>
  <ul>
    <li>Explore your workspace and invite teammates from Settings.</li>
    <li>Add customers and equipment when you are ready.</li>
  </ul>
  <p style="font-size:13px;color:#555;">If you did not create this account, you can ignore this email or contact support.</p>
  <p>— The Equipify team</p>
</body></html>`
  return { subject, html, text }
}

function buildAdminNotifyContent(args: {
  userEmail: string | null
  fullName: string | null
  organizationName: string | null
  organizationId: string
  atIso: string
}) {
  const subject = "[Equipify] New workspace signup"
  const lines = [
    "A new self-serve workspace finished onboarding provisioning.",
    "",
    `Timestamp (UTC): ${args.atIso}`,
    `User email: ${args.userEmail ?? "—"}`,
    `User name: ${args.fullName ?? "—"}`,
    `Organization: ${args.organizationName ?? "—"}`,
    `Organization ID: ${args.organizationId}`,
    `Source: POST /api/onboarding/provision`,
  ]
  const text = lines.join("\n")
  const html = `<pre style="font-family:system-ui,sans-serif;white-space:pre-wrap;">${escapeHtml(text)}</pre>`
  return { subject, html, text }
}

async function mergeUserMetadata(
  admin: SupabaseClient,
  userId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { data, error } = await admin.auth.admin.getUserById(userId)
  if (error || !data?.user) {
    logSignupEmail({ phase: "metadata_read_failed", userId, detail: error?.message })
    return
  }
  const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>
  await admin.auth.admin.updateUserById(userId, {
    user_metadata: { ...meta, ...patch },
  })
}

/**
 * Sends welcome + internal signup notification after successful onboarding provision.
 * - Only for orgs created by this user (`organizations.created_by`); skips invite/join paths.
 * - Idempotent via Supabase Auth `user_metadata` keys per organization id (survives provision retries).
 * - Never throws; email misconfig or Resend errors are logged only.
 */
export async function sendSignupProvisionEmailsIfNeeded(params: {
  admin: SupabaseClient
  userId: string
  userEmail: string | null
  fullName: string | null
  organizationId: string
}): Promise<void> {
  const { admin, userId, userEmail, fullName, organizationId } = params

  const { data: orgRow, error: orgErr } = await admin
    .from("organizations")
    .select("id, name, created_by")
    .eq("id", organizationId)
    .maybeSingle()

  if (orgErr || !orgRow) {
    logSignupEmail({
      phase: "skip",
      reason: "org_lookup_failed",
      organizationId,
      detail: orgErr?.message,
    })
    return
  }

  if (orgRow.created_by !== userId) {
    logSignupEmail({
      phase: "skip",
      reason: "not_workspace_creator",
      organizationId,
      userId,
    })
    return
  }

  const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(userId)
  if (authErr || !authUser?.user) {
    logSignupEmail({ phase: "skip", reason: "auth_user_read_failed", userId, detail: authErr?.message })
    return
  }

  const meta = (authUser.user.user_metadata ?? {}) as Record<string, unknown>
  const welcomeDone = meta[WELCOME_META_KEY] === organizationId
  const adminDone = meta[ADMIN_META_KEY] === organizationId

  if (welcomeDone && adminDone) {
    logSignupEmail({ phase: "skip", reason: "already_sent", organizationId, userId })
    return
  }

  const dashboardUrl = `${getPublicAppOrigin()}/`
  const atIso = new Date().toISOString()
  const orgName = typeof orgRow.name === "string" ? orgRow.name : null

  if (!welcomeDone) {
    if (!userEmail?.trim()) {
      logSignupEmail({
        phase: "welcome_skipped",
        reason: "no_user_email",
        organizationId,
        userId,
      })
    } else {
      const { subject, html, text } = buildWelcomeContent({ fullName, dashboardUrl })
      const result = await sendEmail({
        to: userEmail.trim(),
        subject,
        html,
        text,
        category: "signup_welcome",
        organizationId,
      })
      if (result.ok) {
        await mergeUserMetadata(admin, userId, { [WELCOME_META_KEY]: organizationId })
        logSignupEmail({
          kind: "welcome",
          ok: true,
          organizationId,
          userId,
          resendId: result.id,
        })
      } else {
        logSignupEmail({
          kind: "welcome",
          ok: false,
          organizationId,
          userId,
          code: result.code,
          error: result.error,
        })
      }
    }
  }

  if (!adminDone) {
    const to = getSignupInternalNotifyRecipient()
    const { subject, html, text } = buildAdminNotifyContent({
      userEmail,
      fullName,
      organizationName: orgName,
      organizationId,
      atIso,
    })
    const result = await sendEmail({
      to,
      subject,
      html,
      text,
      category: "signup_internal_notify",
      organizationId,
    })
    if (result.ok) {
      await mergeUserMetadata(admin, userId, { [ADMIN_META_KEY]: organizationId })
      logSignupEmail({
        kind: "admin_notify",
        ok: true,
        organizationId,
        userId,
        resendId: result.id,
      })
    } else {
      logSignupEmail({
        kind: "admin_notify",
        ok: false,
        organizationId,
        userId,
        code: result.code,
        error: result.error,
      })
    }
  }
}
