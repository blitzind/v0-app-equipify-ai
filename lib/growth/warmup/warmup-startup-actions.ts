/**
 * Growth Engine — warmup startup action labels (client-safe).
 */

export type WarmupStartupAction =
  | "created_and_generated"
  | "generated_existing_new"
  | "already_active"
  | "missing_sender"
  | "schedule_generation_failed"

export type WarmupStartupMessageInput = {
  action: WarmupStartupAction
  email?: string | null
  reason?: string | null
}

export function warmupStartupUserMessage(input: WarmupStartupMessageInput): string {
  const email = input.email?.trim() || "this mailbox"
  switch (input.action) {
    case "created_and_generated":
      return `Warmup schedule generated for ${email}.`
    case "generated_existing_new":
      return `Warmup profile already exists. Warmup schedule generated for ${email}.`
    case "already_active":
      return `Warmup is already active for ${email}.`
    case "missing_sender":
      return "Sender account id is required to start warmup."
    case "schedule_generation_failed":
      const reason = input.reason?.trim()
      return reason
        ? `Could not generate warmup schedule because ${reason}.`
        : "Could not generate warmup schedule."
    default:
      return "Warmup startup could not complete."
  }
}

/** Whether connected-mailboxes Start Warmup should call the startup API. */
export function warmupProfileStatusAllowsStart(status: string | null | undefined): boolean {
  const raw = status?.trim().toLowerCase() ?? ""
  if (!raw) return true
  return raw === "new"
}

/** Whether warmup is already running and should not be restarted from the row action. */
export function warmupProfileStatusIsActive(status: string | null | undefined): boolean {
  const raw = status?.trim().toLowerCase() ?? ""
  return raw === "warming" || raw === "active"
}
