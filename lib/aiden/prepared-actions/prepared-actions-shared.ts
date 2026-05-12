import type { AidenPreparedWorkspaceActionId } from "@/lib/aiden/actions/action-types"
import { AIDEN_PREPARED_WORKSPACE_ACTION_IDS } from "@/lib/aiden/actions/action-types"

/** Shared with client components — do not add server-only imports here. */
export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isPreparedWorkspaceActionId(id: string): id is AidenPreparedWorkspaceActionId {
  return (AIDEN_PREPARED_WORKSPACE_ACTION_IDS as readonly string[]).includes(id)
}
