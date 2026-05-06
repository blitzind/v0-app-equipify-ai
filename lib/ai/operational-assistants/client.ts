/**
 * Client-safe exports (no `server-only` transitive imports).
 */
export {
  OPERATIONAL_ASSISTANT_IDS,
  type OperationalAssistantId,
  isOperationalAssistantId,
} from "./types"
export {
  ASSISTANT_TASK_MAP,
  ASSISTANT_UI,
} from "./registry"
export type { OperationalAssistantCard } from "./schema"
