/**
 * Communications Center Phase 3 — delivery lifecycle helpers.
 *
 * Builds an ordered list of lifecycle steps for a single event so the
 * drawer can render a vertical timeline (Created → Queued → Sent →
 * Delivered, with Failed branches inline). Pure functions only —
 * the data comes straight from `communication_events` columns and
 * `metadata` (no extra round trips).
 */

export type LifecycleTone = "muted" | "info" | "success" | "warning" | "danger" | "violet"

export type LifecycleStep = {
  id: string
  label: string
  /** Sublabel — typically a relative time or short reason. */
  detail?: string | null
  /** ISO timestamp if available; used by the drawer for the tabular column. */
  iso?: string | null
  tone: LifecycleTone
  /** Whether this step is considered the current state. */
  current?: boolean
}

export type LifecycleInput = {
  delivery_status: string
  event_type: string
  created_at: string
  scheduled_at?: string | null
  sent_at?: string | null
  delivered_at?: string | null
  failed_at?: string | null
  error_message?: string | null
  metadata?: Record<string, unknown> | null
}

/**
 * Build the lifecycle for a communication event. Order: Created →
 * (Queued|Scheduled) → Sent → Delivered, with branches for Failed,
 * Bounced, Simulated, Draft. Steps without a timestamp render as
 * pending placeholders so users see what's still to happen.
 */
export function buildLifecycle(input: LifecycleInput): LifecycleStep[] {
  const steps: LifecycleStep[] = []
  const md = (input.metadata ?? {}) as Record<string, unknown>

  const isDraft =
    md.is_draft === true || input.event_type === "communication_draft"
  const isSimulated = md.simulated === true || md.test === true
  const status = input.delivery_status

  // Created
  steps.push({
    id: "created",
    label: isDraft ? "Drafted" : "Created",
    iso: input.created_at,
    tone: isDraft ? "muted" : "info",
    current: isDraft && status === "pending",
  })

  // Hand-off (Phase 3) — when a draft has been dispatched.
  const handoffStarted =
    typeof md.handoff_started_at === "string" ? (md.handoff_started_at as string) : null
  const handoffRouteLabel =
    typeof md.handoff_route_label === "string" ? (md.handoff_route_label as string) : null
  if (handoffStarted) {
    steps.push({
      id: "handoff",
      label: handoffRouteLabel ? `Sent via ${handoffRouteLabel}` : "Sent via live route",
      iso: handoffStarted,
      tone: "violet",
    })
  }

  // Scheduled / Queued
  if (input.scheduled_at) {
    steps.push({
      id: "scheduled",
      label: "Scheduled",
      iso: input.scheduled_at,
      tone: "info",
    })
  }
  if (status === "queued") {
    const lastRetryIso =
      typeof md.retry_requested_at === "string" ? (md.retry_requested_at as string) : null
    steps.push({
      id: "queued",
      label: lastRetryIso ? "Re-queued for retry" : "Queued",
      detail: lastRetryIso ? "Waiting for provider sync." : null,
      iso: lastRetryIso ?? input.created_at,
      tone: "warning",
      current: true,
    })
  }

  // Sent
  if (input.sent_at) {
    steps.push({
      id: "sent",
      label: "Sent",
      iso: input.sent_at,
      tone: "success",
      current: status === "sent",
    })
  } else if (status === "sent") {
    steps.push({ id: "sent", label: "Sent", tone: "success", current: true })
  }

  // Delivered
  if (input.delivered_at) {
    steps.push({
      id: "delivered",
      label: "Delivered",
      iso: input.delivered_at,
      tone: "success",
      current: status === "delivered",
    })
  } else if (status === "delivered") {
    steps.push({ id: "delivered", label: "Delivered", tone: "success", current: true })
  }

  // Failed / Bounced (terminal)
  if (status === "failed" || status === "bounced") {
    steps.push({
      id: status,
      label: status === "bounced" ? "Bounced" : "Failed",
      detail: input.error_message ?? null,
      iso: input.failed_at,
      tone: "danger",
      current: true,
    })
  }

  // Skipped
  if (status === "skipped") {
    steps.push({
      id: "skipped",
      label: "Skipped",
      tone: "muted",
      current: true,
    })
  }

  // Simulated marker
  if (isSimulated) {
    steps.push({
      id: "simulated",
      label: "Simulated test",
      detail: "No customer-facing send took place.",
      tone: "violet",
      current: true,
    })
  }

  return steps
}

/**
 * Manager-facing failure explanation. Maps common failure messages
 * into a short hint so the drawer doesn't just dump a provider
 * string. Returns null when no extra hint applies.
 */
export function explainFailure(reason: string | null | undefined): string | null {
  if (!reason) return null
  const lower = reason.toLowerCase()
  if (lower.includes("invalid") && lower.includes("email")) {
    return "The recipient address is invalid — fix it on the customer / contact and re-queue."
  }
  if (lower.includes("rate limit") || lower.includes("too many")) {
    return "Provider rate limit hit. Wait a minute, then retry."
  }
  if (lower.includes("forbidden") || lower.includes("permission")) {
    return "The live route refused the send — usually a billing-tier or per-record permission issue."
  }
  if (lower.includes("not_found") || lower.includes("not found")) {
    return "The related record was archived or deleted before the send completed."
  }
  if (lower.includes("network") || lower.includes("fetch_failed")) {
    return "We couldn't reach the live route. Check your network and retry."
  }
  return null
}
