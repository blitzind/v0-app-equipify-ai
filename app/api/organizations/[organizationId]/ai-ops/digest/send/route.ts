import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireOrgPermission } from "@/lib/api/require-org-permission"
import { runDigestForOrganization } from "@/lib/ai-ops/digest-runner"

export const runtime = "nodejs"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function jsonError(message: string, status: number, code = "error") {
  return NextResponse.json({ error: code, message }, { status })
}

const sendSchema = z
  .object({
    /** Optional override list — useful for "send a test to me" UX. */
    overrideRecipients: z.array(z.string().trim().min(1).max(254)).max(20).optional(),
  })
  .partial()

/**
 * AI Ops Phase 3 — manual digest send.
 *
 * Manager / admin / owner only. Composes and sends the digest right
 * now using the configured (or overridden) recipients. Records a
 * row in `ai_ops_digest_runs` and updates `last_sent_at`.
 *
 * **Internal-only.** Recipients must be staff emails; the route
 * never sends to a customer-facing address.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await context.params
  if (!UUID_RE.test(organizationId)) return jsonError("Invalid organization.", 400, "invalid_org")

  const gate = await requireOrgPermission(organizationId, "canManageWorkspaceSettings")
  if ("error" in gate) return gate.error
  const { supabase, userId } = gate

  let body: unknown = {}
  if (request.headers.get("content-length")) {
    try {
      body = await request.json()
    } catch {
      return jsonError("Invalid JSON body.", 400, "invalid_body")
    }
  }
  const parsed = sendSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(parsed.error.issues.map((i) => i.message).join("; "), 400, "invalid_body")
  }

  const overrideRecipients = parsed.data.overrideRecipients
    ? Array.from(
        new Set(parsed.data.overrideRecipients.map((r) => r.trim().toLowerCase())),
      ).filter((r) => EMAIL_RE.test(r))
    : undefined

  if (parsed.data.overrideRecipients && (overrideRecipients?.length ?? 0) === 0) {
    return jsonError("No valid email addresses provided.", 400, "invalid_email")
  }

  const result = await runDigestForOrganization({
    supabase,
    organizationId,
    triggerKind: "manual",
    triggeredBy: userId,
    overrideRecipients,
  })

  if (result.status === "failed") {
    return NextResponse.json(
      {
        ok: false,
        status: result.status,
        runId: result.runId,
        error: result.errorCode ?? "send_failed",
        message: result.errorMessage,
      },
      { status: 502 },
    )
  }

  return NextResponse.json({
    ok: true,
    status: result.status,
    runId: result.runId,
    itemsCount: result.itemsCount,
    highCount: result.highCount,
    recipients: result.recipients,
    message:
      result.status === "no_recipients"
        ? "No recipients configured — add staff emails in digest settings."
        : result.status === "no_items"
          ? "Nothing urgent at the configured priority threshold."
          : "Digest sent.",
  })
}
